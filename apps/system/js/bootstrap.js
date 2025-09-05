// Entry point that manages lazy loading of resources and
// making the logo screen disappear.

"use strict";

const bsLoad = Date.now();

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app-container');
  const apps = appContainer.querySelectorAll('.app');

  let draggedApp = null;

  apps.forEach(app => {
    app.addEventListener('dragstart', (e) => {
      draggedApp = e.target;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', e.target.outerHTML);
      setTimeout(() => {
        e.target.style.display = 'none';
      }, 0);
    });

    app.addEventListener('dragend', (e) => {
      e.target.style.display = 'block';
      draggedApp = null;
    });

    app.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    app.addEventListener('drop', (e) => {
      e.stopPropagation();
      const targetApp = e.target;

      // 判断是挤走还是合并
      if (Math.random() < 0.5) {
        // 合并逻辑
        const folder = document.createElement('div');
        folder.classList.add('folder');
        folder.appendChild(draggedApp.cloneNode(true));
        folder.appendChild(targetApp.cloneNode(true));

        appContainer.removeChild(draggedApp);
        appContainer.removeChild(targetApp);
        appContainer.appendChild(folder);
      } else {
        // 挤走逻辑
        const indexDragged = Array.from(appContainer.children).indexOf(draggedApp);
        const indexTarget = Array.from(appContainer.children).indexOf(targetApp);

        if (indexDragged < indexTarget) {
          appContainer.insertBefore(draggedApp, targetApp.nextSibling);
        } else {
          appContainer.insertBefore(draggedApp, targetApp);
        }
      }
    });
  });
});
//添加部分


function hideLogo() {
  actionsDispatcher.removeListener("homescreen-ready", hideLogo);
  let logo = document.getElementById("logo");
  if (!logo) {
    return;
  }
  logo.addEventListener(
    "transitionend",
    () => {
      logo.classList.add("hidden");
      logo.classList.remove("starting");
      logo.classList.remove("byebye");
    },
    { once: true }
  );
  logo.classList.add("byebye");
}

// Returns a promise that resolves once the embedder is ready.
function embedderReady() {
  return new Promise((resolve) => {
    if (window.embedder.isReady) {
      resolve();
    } else {
      window.embedder.addEventListener("runtime-ready", resolve, {
        once: true,
      });
    }
  });
}

// Returns a promise that resolves once the daemon is fully ready:
// - the embedder is ready (needed to get daemon events).
// - the daemon itself is connected.
function daemonReady() {
  return new Promise((resolve) => {
    embedderReady().then(() => {
      if (embedder.isDaemonReady()) {
        resolve();
      } else {
        embedder.addEventListener("daemon-reconnected", resolve, {
          once: true,
        });
      }
    });
  });
}

class HomescreenManager {
  constructor() {
    this.homescreenUrl = null;
  }

  async launchInfo() {
    if (!this.homescreenUrl) {
      await this.init();
    }

    return { url: this.homescreenUrl, display: this.display };
  }

  async setInfo(manifestUrl) {
    let port = window.config.isDevice ? "" : ":8081";
    let url = new URL(manifestUrl.replace("$PORT", port));
    // TODO: don't hardcode index.html as the starting url.
    this.homescreenUrl = `${url.origin}/index.html`;

    // Get the display mode from the manifest.
    let response = await fetch(url);
    let manifest = await response.json();
    this.display = manifest.display || "browser";
  }

  async init() {
    let settings = await apiDaemon.getSettings();
    try {
      let result = await settings.get("homescreen.manifestUrl");
      await this.setInfo(result.value);
    } catch (e) { }

    settings.addObserver("homescreen.manifestUrl", async (setting) => {
      await this.setInfo(setting.value);
      // Load the new homescreen
      window.wm.switchHome(this.homescreenUrl, this.display);
    });
  }
}

const homescreenManager = new HomescreenManager();

const customRunner = {
  homescreenLauncher: () => {
    return async () => {
      let { url, display } = await homescreenManager.launchInfo();
      let isDesktop = (embedder.sessionType === "desktop" || embedder.sessionType === "session");
      const params = new URLSearchParams({
        isDesktop: isDesktop
      });
      window.wm.openFrame(`${url}?${params}`, { isHomescreen: true, details: { display } });
      return Promise.resolve();
    };
  },

  wallpaperReady: () => {
    return () => {
      return new Promise((resolve) => {
        let isDesktop = (embedder.sessionType === "desktop" || embedder.sessionType === "session");
        window.wallpaperManager = new window.WallpaperManager(isDesktop);
        window.wallpaperManager.addEventListener("wallpaper-ready", resolve, {
          once: true,
        });
      });
    };
  },

  watchHomescreen: () => {
    return () => {
      actionsDispatcher.addListener("homescreen-ready", hideLogo);
      return Promise.resolve();
    };
  },
};

async function enableRadio(conn, state) {
  let status = new Promise((resolve, reject) => {
    conn.setRadioEnabled(state).then(resolve, reject);
  });
  try {
    await status;
  } catch (e) {
    console.log(`failed to enable radio: ${e}`);
  }
}

// Enable radio by default.
async function setupTelephony() {
  let conns = navigator.b2g?.mobileConnections;
  if (!conns) {
    console.error("navigator.b2g.mobileConnections is not available.");
    return;
  }

  // Use only the first connection for now.
  // TODO: multi-SIM support.

  let conn = conns[0];
  if (!conn) {
    console.error(`No mobile connection available!`);
    return;
  } 

  await enableRadio(conn, false);
  await enableRadio(conn, true);

  // If the radio data is enabled, turn it on and off to force the data
  // connection do be enabled.
  let settings = await apiDaemon.getSettings();
  try {
    let init = await settings.getBatch([
      "ril.data.defaultServiceId",
      "ril.data.apnSettings.sim1",
      "ril.data.roaming_enabled",
      "ril.data.enabled",
    ]);
    let dataEnabled = false;
    init.forEach((item) => {
      if (item.name === "ril.data.enabled") {
        dataEnabled = item.value;
      }
    });

    if (dataEnabled) {
      await settings.set([{ name: "ril.data.enabled", value: false }]);
      await new Promise((resolve) => {
        window.setTimeout(resolve, 5000);
      });
      await settings.set(init);
    }
  } catch (e) { }

  // Open the dialer when we receive an incoming call.
  navigator.b2g.telephony.onincoming = () => {
    // If the screen is turned off, turn it on.
    actionsDispatcher.dispatch("set-screen-on");

    // If the screen is locked, launch through the lockscreen.
    let url = `http://dialer.localhost:${config.port}/index.html?incoming`;
    if (window.lockscreen.isLocked()) {
      window.lockscreen.launch(url);
    } else {
      window.wm.openFrame(url, {
        activate: true,
      });
    }
  };
}

window.utils = {
  // Helper to localize a single string.
  l10n: async (id, args) => {
    return await document.l10n.formatValue(id, args);
  },

  // Helper to truncate a search string. Used by the context menu
  // and by the site info panel.
  truncateSearch: (text) => {
    if (text.length > 15) {
      let truncLength = 15;
      let truncChar = text[15].charCodeAt(0);
      if (truncChar >= 0xdc00 && truncChar <= 0xdfff) {
        truncLength++;
      }
      let ellipsis = "\u2026";
      try {
        ellipsis = Services.prefs.getComplexValue(
          "intl.ellipsis",
          Ci.nsIPrefLocalizedString
        ).data;
      } catch (e) { }
      text = text.substr(0, truncLength) + ellipsis;
    }
    return text;
  },

  // Helper to pick a random search engine.
  // Returns a Promise that resolves with the final url.
  randomSearchEngineUrl(text) {
    return new Promise(async (resolve) => {
      let openSearch = contentManager.getOpenSearchManager((items) => {
        // Remove items that are not enabled.
        items = items.filter((item) => {
          let meta = item.meta;
          return meta.tags.includes("enabled");
        });

        // Pick one search engine.
        let engine = items[Math.floor(Math.random() * items.length)];
        let desc = engine.variant("default").OpenSearchDescription;

        // Replace the text in the searchTerms.
        let urls = desc.Url;
        if (!Array.isArray(urls)) {
          urls = [urls];
        }
        let found = urls.find((item) => item._attributes.type == "text/html");
        if (!found) {
          return;
        }
        let template = found._attributes.template;
        let encoded = encodeURIComponent(text).replace(
          /[!'()*]/g,
          function (c) {
            return "%" + c.charCodeAt(0).toString(16);
          }
        );
        let url = template.replace("{searchTerms}", encoded);

        resolve(url);
      });
      await openSearch.init();
    });
  },
};

function setupWebExtensions() {
  // Listen to WebExtension lifecycle events.
  [
    "onEnabling",
    "onEnabled",
    "onDisabling",
    "onDisabled",
    "onInstalling",
    "onInstalled",
    "onUninstalling",
    "onUninstalled",
    "onOperationCancelled",
  ].forEach((event) => {
    navigator.mozAddonManager.addEventListener(event, (data) => {
      console.log(`WebExtensions: event ${data.type} id=${data.id}`);

      if (data.type == "onUninstalling") {
        let settings = document.querySelector("quick-settings");
        settings.removeBrowserAction(data.id);
      }
    });
  });
}

// Check wether we need to run the FTU, and if so launch it.
async function manageFTU() {
  let settings = await apiDaemon.getSettings();
  let ftuDone = false;
  try {
    let result = await settings.get("ftu.done");
    ftuDone = result.value;
  } catch (e) { }

  window.config.ftuDone = ftuDone;

  if (ftuDone) {
    return;
  }

  await window.lockscreen.launch(
    `http://ftu.localhost:${config.port}/index.html`,
    { ftu: true }
  );
  try {
    await settings.set([{ name: "ftu.done", value: true }]);
    window.config.ftuDone = true;
    // Unlock the lock screen when finishing the FTU.
    window.lockscreen.unlock();
  } catch (e) {
    console.error(`Failed to register FTU as done: ${e}`);
  }
}

// TODO: move to its own file.
class TorProxyChannelFilter {
  constructor() {
    this.proxyService = Cc[
      "@mozilla.org/network/protocol-proxy-service;1"
    ].getService(Ci.nsIProtocolProxyService);
    this.proxyService.registerChannelFilter(
      this /* nsIProtocolProxyChannelFilter aFilter */,
      0 /* unsigned long aPosition */
    );

    this.torEnabled = false;
    this.localhosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

    this.init();
  }

  async init() {
    let settings = await apiDaemon.getSettings();
    try {
      const result = await settings.get("tor.enabled");
      this.torEnabled = result.value;

      settings.addObserver("tor.enabled", async (setting) => {
        this.torEnabled = setting.value;
      });
    } catch (e) {
      console.error(`TorProxyChannelFilter: failed to get Tor setting: ${e}`);
    }
  }

  applyFilter(channel, defaultProxyInfo, proxyFilter) {
    // console.log(`Proxy applyFilter tor=${this.torEnabled} ${channel.name}`);

    if (!this.torEnabled) {
      proxyFilter.onProxyFilterResult(defaultProxyInfo);
      return;
    }

    let wrapper = ChannelWrapper.get(channel);
    let doNotProxy = true;
    try {
      const url = new URL(wrapper.finalURL);
      const hostname = url.hostname;
      doNotProxy =
        this.localhosts.has(hostname) || hostname.endsWith(".localhost");
    } catch (e) { }
    if (doNotProxy) {
      proxyFilter.onProxyFilterResult(defaultProxyInfo);
    } else {
      // DNS is resolved on the SOCKS proxy server.
      const { TRANSPARENT_PROXY_RESOLVES_HOST } = Ci.nsIProxyInfo;

      // See https://searchfox.org/mozilla-central/rev/d4ebb53e719b913afdbcf7c00e162f0e96574701/netwerk/base/nsIProtocolProxyService.idl#154
      // TODO: don't hardcode the port number to 9150
      let proxyInfo = this.proxyService.newProxyInfo(
        "socks",
        "127.0.0.1",
        9150,
        null,
        null,
        TRANSPARENT_PROXY_RESOLVES_HOST,
        0,
        null
      );
      proxyFilter.onProxyFilterResult(proxyInfo);
    }
  }
}

function configureTopStatus() {
  let enableTopStatus = Services.prefs.getBoolPref(
    "ui.status-top.enabled",
    false
  );

  if (window.config.topStatusBar === enableTopStatus) {
    return;
  }

  window.config.topStatusBar = enableTopStatus;
  if (!enableTopStatus) {
    document.getElementById("screen").classList.remove("show-top-status-bar");
  } else {
    document.getElementById("screen").classList.add("show-top-status-bar");
    let height = Services.prefs.getIntPref("ui.status-top-height", 26);
    const rootElement = document.documentElement;
    rootElement.style.setProperty("--status-top-height", `${height}px`);
  }
  window.actionsDispatcher?.dispatch("top-status-bar-changed", enableTopStatus);
}

var graph;
async function ensurePanelManager() {
  let result = await graph.waitForDeps("search");
  let module = result.get("search panel");
  return new module.SearchPanel();
}
export { ensurePanelManager };
document.addEventListener(
  "DOMContentLoaded",
  async () => {
    configureTopStatus();
    Services.prefs.addObserver("ui.status-top.enabled", configureTopStatus);

    // Make sure the embedding is setup.
    await window.embedderSetupDone;

    // First wait for the daemon to be up, since we can't load the
    // dependency resolver from shared.localhost before!
    await daemonReady();

    // Load <link rel="stylesheet" href="style/{device|desktop}.css" />
    addStylesheet(`style/${isDevice ? "device" : "desktop"}.css`);

    // Load the shared style.
    addStylesheet(
      `http://shared.localhost:${window.config.port}/style/themes/default/theme.css`
    );

    await depGraphLoaded();
    let platform = embedder.isGonk() ? "gonk" : "linux";
    graph = new ParallelGraphLoader(addShoelaceDeps(kDeps), customRunner, {
      platform,
    });
    // Start with the lock screen on before we load the homescreen to avoid a
    // flash of the homescreen.
    await graph.waitForDeps("lockscreen comp");
    if (embedder.sessionType !== "desktop") {
      window.lockscreen.lock();
    }

    await graph.waitForDeps("phase1");
    await graph.waitForDeps("launch");

    await manageFTU();
    keyManager.registerShortPressAction(config.powerKey, "power");
    keyManager.registerLongPressAction(config.powerKey, "power");
    keyManager.registerShortPressAction("PrintScreen", "printscreen");
    setupTelephony();

    await graph.waitForDeps("audio volume");

    embedder.addEventListener("headphones-status-changed", async (event) => {
      if (event.detail === "headset") {
        let msg = await window.utils.l10n("headset-plugged");
        window.toaster.show(msg);
      }
    });

    // The opensearch resources need to be ready before launching the FTU.
    let openSearch = contentManager.getOpenSearchManager();
    await openSearch.ready();

    window.onuserproximity = (event) => {
      console.log(`D/hal === userproximity event: near=${event.near}`);
    };

    // window.ondevicelight = (event) => {
    //   console.log(`D/hal === devicelight event: value=${event.value}`);
    // };

    // window.ondevicemotion = (event) => {
    //   console.log(`D/hal === devicemotion event: ${event}`);
    // };

    // window.onabsolutedeviceorientation = (event) => {
    //   console.log(
    //     `D/hal === absolutedeviceorientation event: absolute=${event.absolute} a=${event.alpha} b=${event.beta} g=${event.gamma}`
    //   );
    // };

    // window.ondeviceorientation = (event) => {
    //   console.log(
    //     `D/hal === deviceorientation event: absolute=${event.absolute} a=${event.alpha} b=${event.beta} g=${event.gamma}`
    //   );
    // };

    const torFilter = new TorProxyChannelFilter();
    setupWebExtensions();

    let _ucan = new Ucan();

    embedder.addEventListener("geolocation-status", (event) => {
      let status = document.getElementById("status-icons");
      status.geoloc = event.detail.active;
    });

    let xac = await import(
      `http://shared.localhost:${config.port}/xac/peer.js`
    );
    let peer = new xac.Peer();
    peer.addEventListener("ready", () => {
      console.log(`XAC: SystemApp received ready!`);
    });

    window.XacHomescreen = {
      isAppInHomescreen: (url) => {
        return peer.send("homescreen.localhost", "isAppInHomescreen", url);
      },
      newTab: () => {
        return peer.send("homescreen.localhost", "newTab");
      },
    };
    // Load dependencies that are not in the critical launch path.
    graph.waitForDeps("late start");
  },
  { once: true }
);
