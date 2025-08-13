// <quick-settings> panel

class QuickSettings extends HTMLElement {
  constructor() {
    super();

    let shadow = this.attachShadow({ mode: "open" });

    shadow.innerHTML = `
    <link rel="stylesheet" href="components/quick_settings.css">
    <div class="container">
      <section class="telephony-info">
        <div class="bars">
          <div class="bar0"></div>
          <div class="bar1"></div>
          <div class="bar2"></div>
          <div class="bar3"></div>
        </div>
        <span></span>
      </section>
      <section class="switches">
        <sl-badge pill variant="neutral"><sl-icon class="wifi-icon inactive" name="wifi-off"></sl-icon></sl-badge>
        <sl-badge pill variant="neutral"><sl-icon class="flashlight-icon inactive" name="flashlight-off"></sl-icon></sl-badge>
        <div class="flex-fill"></div>
        <sl-badge pill variant="neutral" id="tor-icon"><img src="./resources/tor.ico"></sl-badge>
        <sl-icon name="monitor" id="display-preferences-icon"></sl-icon>
        <sl-icon name="star" id="new-feature-icon"></sl-icon>
        <img id="settings-icon" src="http://settings.localhost:${config.port}/icons/settings.svg"/>
        <sl-icon name="log-out" id="logout-icon"></sl-icon>
        <sl-icon name="lock" id="lock-icon"></sl-icon>
      </section>
      <section id="brightness-section">
        <sl-icon name="sun"></sl-icon>
        <sl-range id="brightness" name="brightness" min="0" max="100" value="100"></sl-range>
      </section>
      <section class="notifications"></section>
      <section class="peers"></section>
      <section class="browser-actions"></section>
      <media-controller-list></media-controller-list>
    </div>
    `;

    this.drawer = this.parentElement;

    document.l10n.translateFragment(shadow);

    actionsDispatcher.addListener("open-quick-settings", () => {
      this.drawer.show();
    });

    actionsDispatcher.addListener("hide-quick-settings", () => {
      this.drawer.hide();
    });

    this.initWifi();
    this.initFlashlight();
    this.initBrightness();
    this.initTelephony();
    this.initTor();
    this.initP2P();

    let sessionType = embedder.sessionType;

    let logoutIcon = shadow.querySelector("#logout-icon");
    if (sessionType == "session" || sessionType == "desktop") {
      logoutIcon.onclick = embedder.logOut;
    } else {
      logoutIcon.remove();
    }

    let lockIcon = shadow.querySelector("#lock-icon");
    if (sessionType == "mobile" || sessionType == "desktop") {
      lockIcon.remove();
    } else {
      lockIcon.onclick = () => {
        actionsDispatcher.dispatch("set-screen-off");
      };
    }

    shadow.querySelector("#settings-icon").onclick = () => {
      this.drawer.hide();
      window.wm.openFrame(
        `http://settings.localhost:${config.port}/index.html`,
        { activate: true }
      );
    };

    shadow.querySelector("#display-preferences-icon").onclick = () => {
      if (!embedder.isGonk()) {
        this.drawer.hide();
        this.openDisplayPreferences();
      }
    };

    // 初始化桌面模式状态，与 wallpaperManager 保持同步
    this.initializeDesktopState();
    
    shadow.querySelector("#new-feature-icon").onclick = () => {
      this.drawer.hide();
      this.handleNewFeatureClick();
    };
  }

  async initializeDesktopState() {
    try {
      // 从设置中读取桌面模式状态
      const settings = await apiDaemon.getSettings();
      let savedDesktopState;
      try {
        const result = await settings.get("ui.desktop-mode");
        savedDesktopState = result.value;
        console.log(`QuickSettings: Loaded desktop state from settings: ${savedDesktopState}`);
      } catch (e) {
        // 如果设置不存在，使用默认值
        savedDesktopState = true; // 默认桌面模式
        console.log(`QuickSettings: No saved desktop state found, using default: ${savedDesktopState}`);
      }
      
      this.isDesktop = savedDesktopState;
      
      // 与 wallpaperManager 保持同步
      if (window.wallpaperManager) {
        window.wallpaperManager.isDesktop = this.isDesktop;
      } else {
        // 如果 wallpaperManager 还未加载，等待其准备就绪后同步状态
        window.addEventListener('wallpaper-manager-ready', () => {
          window.wallpaperManager.isDesktop = this.isDesktop;
          console.log(`QuickSettings: Synchronized state to wallpaperManager: ${this.isDesktop}`);
        });
      }
      
      console.log(`QuickSettings: Desktop state initialized to ${this.isDesktop}`);
    } catch (e) {
      console.error(`QuickSettings: Failed to initialize desktop state: ${e}`);
      this.isDesktop = true; // 默认桌面模式
    }
  }

  connectedCallback() {
    this.dispatchEvent(
      new CustomEvent("quick-settings-connected", { bubbles: true })
    );
  }

  async initBrightness() {
    let slider = this.shadowRoot.querySelector("#brightness");
    slider.addEventListener("sl-input", (event) => {
      // console.log(`Brightness changed to ${event.target.value}`);
      window.powerManager.service.brightness = event.target.value;
    });

    slider.onpointerdown = () => {
      this.classList.add("adjust-brightness");
      this.drawer.classList.add("adjust-brightness");
    };

    slider.onpointerup = () => {
      this.classList.remove("adjust-brightness");
      this.drawer.classList.remove("adjust-brightness");
    };

    if (window.powerManager) {
      let service = window.powerManager.service;
      await service.ready();
      slider.value = await service.brightness;
    }
  }

  async initTor() {
    let torIcon = this.shadowRoot.querySelector("#tor-icon");

    let settings = await apiDaemon.getSettings();

    async function settingOrDefault(name, defaultValue) {
      try {
        let res = await settings.get(name);
        return res.value;
      } catch (e) {
        return defaultValue;
      }
    }

    let statusIcons = document.getElementById("status-icons");
    statusIcons.tor = false;

    let torEnabled = await settingOrDefault("tor.enabled", false);
    if (!torEnabled) {
      torIcon.classList.add("disabled");
      torIcon.variant = "neutral";
      torIcon.pulse = false;
    } else {
      torIcon.classList.add("enabling");
      torIcon.variant = "primary";
      torIcon.pulse = true;
    }
    const status = await settingOrDefault("tor.status", { ready: false });
    let torReady = status.ready;
    if (torReady) {
      statusIcons.tor = true;
      torIcon.classList.remove("enabling");
      torIcon.variant = "primary";
      torIcon.pulse = false;
    }

    settings.addObserver("tor.enabled", async (setting) => {
      torEnabled = setting.value;
      if (torEnabled) {
        torIcon.classList.remove("disabled");
        torIcon.classList.add("enabling");
        torIcon.variant = "primary";
        torIcon.pulse = true;
      } else {
        torIcon.classList.remove("enabling");
        torIcon.classList.add("disabled");
        torIcon.variant = "neutral";
        torIcon.pulse = false;
        statusIcons.tor = false;
      }
      let msg = await window.utils.l10n(
        torEnabled ? "tor-enabling" : "tor-disabled"
      );
      window.toaster.show(msg, torEnabled ? "primary" : "success");
    });

    settings.addObserver("tor.status", async (setting) => {
      if (setting.value.ready != torReady) {
        torReady = setting.value.ready;
        console.log(`Tor: status is ${JSON.stringify(setting.value)}`);
        statusIcons.tor = torReady;
        if (torReady) {
          torIcon.classList.remove("enabling");
          torIcon.variant = "primary";
          torIcon.pulse = false;
          let msg = await window.utils.l10n("tor-enabled");
          window.toaster.show(msg, "success");
        }
      }
    });

    torIcon.addEventListener("click", async (event) => {
      event.stopPropagation();
      await settings.set([{ name: "tor.enabled", value: !torEnabled }]);
    });
  }

  initFlashlight() {
    let flIcon =
      this.shadowRoot.querySelector(".flashlight-icon").parentElement;
    if (!navigator.b2g?.getFlashlightManager) {
      flIcon.remove();
      return;
    }

    flIcon.addEventListener("click", (event) => {
      event.stopPropagation();
      flashlightManager.toggle();
    });

    actionsDispatcher.addListener(
      "flashlight-state-change",
      (_name, enabled) => {
        flIcon.variant = enabled ? "primary" : "neutral";
        flIcon.firstElementChild.setAttribute(
          "name",
          enabled ? "flashlight" : "flashlight-off"
        );
      }
    );
  }

  initWifi() {
    if (!navigator.b2g || !navigator.b2g.wifiManager) {
      console.warn("No Wifi Support");
      return;
    }

    this.wifi = navigator.b2g.wifiManager;
    this.wifiIcon = this.shadowRoot.querySelector(".wifi-icon");

    if (this.wifi.enabled) {
      this.wifiIcon.parentElement.variant = "primary";
      this.wifiIcon.setAttribute("name", "wifi");
    }

    // Setup event listeners.
    ["enabled", "disabled", "statuschange", "captiveportallogin"].forEach(
      (event) => {
        this.wifi.addEventListener(event, this);
      }
    );

    // Toggle Wifi when clicking on the icon.
    this.wifiIcon.parentElement.addEventListener("click", (event) => {
      event.stopPropagation();
      this.wifi.setWifiEnabled(!this.wifi.enabled);
    });
  }

  async addOrUpdateNotification(notification) {
    let unique = await notification.id;
    let existing = this.shadowRoot.querySelector(`#notification-${unique}`);
    if (existing) {
      existing.setNotification(notification);
    } else {
      let node = new WebNotification(notification);
      node.setAttribute("id", `notification-${unique}`);
      this.shadowRoot.querySelector(".notifications").appendChild(node);
      node.addEventListener(
        "clicked",
        () => {
          this.drawer.hide();
        },
        { once: true }
      );
    }
  }

  async removeNotification(notification) {
    let unique = await notification.id;
    let existing = this.shadowRoot.querySelector(`#notification-${unique}`);
    if (existing) {
      existing.remove();
    }
  }

  getNotifications() {
    let result = [];
    let notifs = this.shadowRoot.querySelectorAll(
      ".notifications web-notification"
    );
    if (notifs) {
      notifs.forEach((notif) => result.push(notif._wrapper.notification));
    }
    return result;
  }

  initP2P() {
    let appHandler = this.updatePeerApps.bind(this);
    window.appsManager.addEventListener("app-installed", appHandler);
    window.appsManager.addEventListener("app-uninstalled", appHandler);
  }

  async updatePeerApps() {
    let apps = await navigator.b2g.activityUtils.getInstalled("p2p-tile-start");
    let disabled = apps.length == 0;
    let container = this.shadowRoot.querySelector(".peers");
    if (disabled) {
      container.classList.add("not-launchable");
    } else {
      container.classList.remove("not-launchable");
    }

    let controlApps = await navigator.b2g.activityUtils.getInstalled(
      "remote-control"
    );
    let remoteDisabled = controlApps.length == 0;
    if (remoteDisabled) {
      container.classList.add("not-remotable");
    } else {
      container.classList.remove("not-remotable");
    }
  }

  async addPeer(peer, handler) {
    let node = document.createElement("div");
    node.classList.add("peer");
    let desc = document.createElement("span");
    desc.textContent = peer.deviceDesc;
    node.append(desc);

    let tag = document.createElement("sl-tag");
    tag.dataset.l10nId = "peer-paired";
    tag.classList.add("when-paired");
    tag.setAttribute("variant", "success");
    tag.setAttribute("pill", "true");
    node.append(tag);

    let apps = document.createElement("sl-button");
    apps.dataset.l10nId = "launch-peer-app";
    apps.classList.add("launch");
    apps.classList.add("when-paired");
    node.append(apps);

    let remote = document.createElement("sl-button");
    remote.setAttribute("circle", "");
    let icon = document.createElement("img");
    icon.src = "./resources/remotecontrol.png";
    remote.append(icon);
    remote.classList.add("remote");
    remote.classList.add("when-paired");
    node.append(remote);

    let button = document.createElement("sl-button");
    button.dataset.l10nId = "connect-peer";
    button.classList.add("when-unpaired");
    button.onclick = () => {
      this.drawer.hide();
      handler(peer);
    };
    node.append(button);

    let id = `peer-${peer.did}-${peer.deviceId}`.replaceAll(":", "-");
    node.setAttribute("id", id);

    document.l10n.translateFragment(node);

    this.shadowRoot.querySelector(".peers").appendChild(node);
    await this.updatePeerApps();
  }

  removePeer(peer) {
    let id = `#peer-${peer.did}-${peer.deviceId}`.replaceAll(":", "-");
    let existing = this.shadowRoot.querySelector(id);
    if (existing) {
      existing.remove();
    }
  }

  peerPaired(session) {
    let peer = session.peer;
    let id = `#peer-${peer.did}-${peer.deviceId}`.replaceAll(":", "-");
    let node = this.shadowRoot.querySelector(id);
    if (node) {
      node.querySelector(".launch").onclick = () => {
        this.drawer.hide();
        try {
          let act = new WebActivity("p2p-tile-start", {
            sessionId: session.id,
          });
          act.start();
        } catch (e) {
          console.error(
            `p2p: failed to launch tile for session ${session.id}: ${e}`
          );
        }
      };

      node.querySelector(".remote").onclick = () => {
        this.drawer.hide();
        console.log(
          `ZZZ starting remote control of ${JSON.stringify(session)}`
        );
        let act = new WebActivity("remote-control", { session });
        act.start();
      };
      node.classList.add("paired");
    }
  }

  handleEvent(event) {
    // console.log(`Wifi: event ${event.type}`);
    switch (event.type) {
      case "enabled":
        // console.log(`ZZZ Wifi enabled`);
        this.wifiIcon.parentElement.variant = "neutral";
        this.wifiIcon.setAttribute("name", "wifi");
        this.wifi.getNetworks();
        break;
      case "disabled":
        // console.log(`ZZZ Wifi disabled`);
        this.wifiIcon.parentElement.variant = "neutral";
        this.wifiIcon.setAttribute("name", "wifi-off");
        break;
      case "statuschange":
        // console.log(`ZZZ Wifi status changed to ${event.status} for ${event.network.ssid}`);
        if (event.status == "connected") {
          this.wifiIcon.parentElement.variant = "primary";
          this.wifiIcon.classList.remove("inactive");
          this.wifiIcon.classList.add("active");
        } else {
          this.wifiIcon.parentElement.variant = "neutral";
          this.wifiIcon.classList.remove("active");
          this.wifiIcon.classList.add("inactive");
        }
        break;
      case "captiveportallogin":
        // console.log(`ZZZ Wifi captiveportallogin success=${loginSuccess}`);
        // TODO: Use a notification instead of opening directly the login page.
        if (event.loginSuccess) {
          // Close the captive portal frame if it was opened.
          window.wm.closeCaptivePortal();
        } else {
          // Open a window to give the opportunity to login.
          window.wm.openCaptivePortal();
        }
        break;
    }
  }

  initTelephony() {
    let conns, dataCallManager;
    try {
      conns = navigator.b2g?.mobileConnections;
      dataCallManager = navigator.b2g?.dataCallManager;
    } catch (e) { }

    if (!conns || !dataCallManager) {
      console.error("mobileConnections or dataCallManager are not available.");
      this.shadowRoot.querySelector(".telephony-info").remove();
      return;
    }

    // Use the first SIM.
    let conn = conns[0];
    if (!conn) {
      console.error(`No mobile connection available!`);
      return;
    }

    let textNode = this.shadowRoot.querySelector(".telephony-info span");
    let signalBars = [];
    for (let i = 0; i < 4; i++) {
      signalBars.push(
        this.shadowRoot.querySelector(`.telephony-info .bars .bar${i}`)
      );
    }

    const updateDisplay = async () => {
      if (conn.radioState === "disabled") {
        textNode.textContent = "";
        for (let i = 0; i < 4; i++) {
          signalBars[i].classList.add("inactive");
        }
        return;
      }

      let dataCallState = "unknown";
      try {
        dataCallState = await dataCallManager.getDataCallState("default");
      } catch (e) {
        console.error(`Error getting dataCallState: ${e}`);
      }

      let text =
        conn.data.network?.shortName || conn.voice.network?.shortName || "";

      // Map connection types to user friendly names.
      const mobileDataTypes = {
        lte: "4G", // 4G LTE
        lte_ca: "4G", // 4G LTE Carrier Aggregation
        ehrpd: "4G", // 4G CDMA
        "hspa+": "H+", // 3.5G HSPA+
        hsdpa: "H",
        hsupa: "H",
        hspa: "H", // 3.5G HSDPA
        evdo0: "EV",
        evdoa: "EV",
        evdob: "EV", // 3G CDMA
        umts: "3G", // 3G
        tdscdma: "3G", // TDS-CDMA
        edge: "E", // EDGE
        gprs: "2G",
        "1xrtt": "2G",
        is95a: "2G",
        is95b: "2G", // 2G CDMA
      };

      if (dataCallState === "connected" && conn.data.type) {
        text = `${text} — ${mobileDataTypes[conn.data.type] || conn.data.type
          }⇅`;
      } else if (conn.voice.type) {
        text = `${text} — ${mobileDataTypes[conn.voice.type] || conn.voice.type
          }`;
      } else if (conn.voice.emergencyCallsOnly) {
        let msg = await window.utils.l10n("emergency-calls-only");
        text = `${text} — ${msg}`;
      }
      if (conn.voice.roaming || conn.data.roaming) {
        text += ` 🌍`;
      }

      textNode.textContent = text;

      let level = conn.signalStrength.level; // ranges from -1 to 4.
      if (level !== -1) {
        // Update the bar graph.
        for (let i = 0; i < 4; i++) {
          if (i < level) {
            signalBars[i].classList.remove("inactive");
          } else {
            signalBars[i].classList.add("inactive");
          }
        }
      } else {
        // level == -1 means out-of-service.
        for (let i = 0; i < 4; i++) {
          signalBars[i].classList.add("inactive");
        }
      }
    };

    conn.onradiostatechange = conn.ondatachange = updateDisplay;
    updateDisplay();
  }

  // Turn an extension id into a string usable in css selectors.
  safeExtensionId(id) {
    let a = encodeURIComponent(id).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return p1.toString(16);
    });
    return a.replace(/\./, "--");
  }

  addBrowserAction(extensionId, node) {
    let id = `browser-action-${this.safeExtensionId(extensionId)}`;
    // console.log(`addBrowserAction ${extensionId} -> ${id}`);
    if (!this.shadowRoot.querySelector(`#${id}`)) {
      this.shadowRoot.querySelector(".browser-actions").append(node);
      node.setAttribute("id", id);
    }
  }

  removeBrowserAction(extensionId) {
    // console.log(`removeBrowserAction`);
    this.getBrowserAction(extensionId)?.remove();
  }

  getBrowserAction(extensionId) {
    // console.log(`getBrowserAction ${extensionId}`);
    return this.shadowRoot.querySelector(
      `#browser-action-${this.safeExtensionId(extensionId)}`
    );
  }

  openDisplayPreferences() {
    // Create display preferences dialog if it doesn't exist
    if (!this.displayPreferences) {
      this.displayPreferences = document.createElement('display-preferences');
      document.body.appendChild(this.displayPreferences);
    }

    // Show the dialog
    this.displayPreferences.show();
  }

  async handleNewFeatureClick() {
    const overlay = document.getElementById("blackOverlay");
    overlay.style.display = "block";
    overlay.style.opacity = "1"
    var w = 0;
    var h = 0;
    
    // 获取当前实际的 isDesktop 状态
    let currentIsDesktop = this.isDesktop;
    if (window.wallpaperManager && window.wallpaperManager.isDesktop !== this.isDesktop) {
      // 如果状态不同步，以 wallpaperManager 为准
      currentIsDesktop = window.wallpaperManager.isDesktop;
      this.isDesktop = currentIsDesktop;
    }
    
    // 切换到新状态
    let newIsDesktop = !currentIsDesktop;
    this.isDesktop = newIsDesktop;
    
    // 保存新状态到设置中
    try {
      const settings = await apiDaemon.getSettings();
      await settings.set([{ name: "ui.desktop-mode", value: newIsDesktop }]);
      console.log(`QuickSettings: Saved desktop state to settings: ${newIsDesktop}`);
    } catch (e) {
      console.error(`QuickSettings: Failed to save desktop state: ${e}`);
    }
    
    if (!newIsDesktop) {
      h = window.screen.height;
      w = Math.min(h / 1.5, window.screen.width);
    } else {
      w = window.screen.width;
      h = window.screen.height;
    }
    
    console.log(`Switching desktop mode from ${currentIsDesktop} to ${newIsDesktop}`);
    
    // 发送桌面模式切换事件
    window.dispatchEvent(new CustomEvent('desktop-mode-changed', {
      detail: { isDesktop: newIsDesktop }
    }));
    
    // 切换壁纸
    if (window.wallpaperManager) {
      window.wallpaperManager.switchWallpaper(newIsDesktop);
    }
    
    setTimeout(() => {
      window.top.dispatchEvent(new CustomEvent("changeSize", {
        detail: {
          x: ((window.screen.width - w) / 2) | 0,
          y: 0,
          width: w,
          height: h
        }
      }));
      setTimeout(() => {
        overlay.style.opacity = "0";
        overlay.style.display = "none";
      }, 100);
    }, 300);
  }
}

customElements.define("quick-settings", QuickSettings);
