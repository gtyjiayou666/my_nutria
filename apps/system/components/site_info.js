// Represents a <site-info> dialog.

class SiteInfo extends HTMLElement {
  constructor() {
    super();

    this.tosdrData = null;

    let shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
    <link rel="stylesheet" href="components/site_info.css">
    <div class="container">
      <h4 id="url-box">
        <img class="favicon">
        <div>
          <div class="title"></div>
          <div class="url"></div>
        </div>
      </h4>
      <sl-divider></sl-divider>
      <div class="utils search">
        <sl-dropdown placement="top-start" hoist>
          <sl-button slot="trigger" caret></sl-button>
          <sl-menu>
          </sl-menu>
        </sl-dropdown>
        <span class="flex-fill"></span>
      </div>
      <div class="utils">
        <sl-button variant="neutral" size="small" class="add-home hidden favorite">
          <div>
            <img src="resources/pwalogo.svg" height="12px">
            <span></span>
            <!-- inline copy of the "star" icon to be able to change the fill color -->
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
        </sl-button>
        <sl-button variant="neutral" size="small" class="split-screen" data-l10n-id="site-info-split-screen"></sl-button>
        <span class="flex-fill"></span>
        <sl-icon name="chevron-down" class="more-info"></sl-icon>
      </div>
      <div class="utils additional-info">
        <img class="tosdr-img"/>
        <span class="flex-fill"></span>
      </div>
      <div class="utils additional-info">
        <sl-select hoist size="small" class="ua-chooser">
          <span slot="label" data-l10n-id="site-info-choose-ua"></span>
          <sl-option value="b2g" data-l10n-id="site-info-b2g-ua"></sl-option>
          <sl-option value="android" data-l10n-id="site-info-android-ua"></sl-option>
          <sl-option value="desktop" data-l10n-id="site-info-desktop-ua"></sl-option>
        </sl-select>
        <span class="flex-fill"></span>
      </div>
      <sl-divider></sl-divider>
      <div class="utils">
        <sl-icon class="nav-reload" name="refresh-cw"></sl-icon>
        <sl-icon class="nav-back" name="chevron-left"></sl-icon>
        <sl-icon class="nav-forward" name="chevron-right"></sl-icon>
        <sl-icon name="file-text" class="reader-mode hidden"></sl-icon>
        <span class="flex-fill"></span>
        <sl-icon class="share" name="share-2"></sl-icon>
        <sl-icon class="zoom-out" name="zoom-out"></sl-icon>
        <span class="zoom-level">100%</span>
        <sl-icon class="zoom-in" name="zoom-in"></sl-icon>
      </div>
    </div>
    `;

    this.classList.add("hide-additional-info");

    let l10nReady = document.l10n.translateFragment(shadow);

    this.tosdrImg = shadow.querySelector(".tosdr-img");

    this.addEventListener("click", (event) => {
      // Prevent clicks to reach the backdrop and close the panel.
      event.stopPropagation();
    });

    shadow.querySelector("#url-box").onclick = (event) => {
      this.close();
      actionsDispatcher.dispatch("open-url-editor", this.state.url);
    };

    let uaChooser = shadow.querySelector(".ua-chooser");

    l10nReady.then(() => {
      uaChooser.value = "b2g";
      uaChooser.addEventListener("sl-change", (event) => {
        this.dispatchEvent(
          new CustomEvent("change-ua", { detail: event.target.value })
        );
      });
    });

    this.readerMode = shadow.querySelector("sl-icon.reader-mode");
    this.zoomLevel = shadow.querySelector(".zoom-level");

    this.searchSection = shadow.querySelector(".search");
    this.searchEngines = null;

    this.stateUpdater = this.updateState.bind(this);
    this.drawer = this.parentElement;

    shadow.querySelector(".more-info").onclick = (event) => {
      this.classList.toggle("hide-additional-info");
      event.target.setAttribute(
        "name",
        this.classList.contains("hide-additional-info")
          ? "chevron-down"
          : "chevron-up"
      );
    };
  }

  close() {
    actionsDispatcher.removeListener("update-page-state", this.stateUpdater);

    this.dispatchEvent(new CustomEvent("close"));
    this.drawer.hide();
  }

  async updateTosdr() {
    this.tosdrImg.classList.add("hidden");

    let url;
    try {
      url = new URL(this.state.url);
    } catch (e) {
      return;
    }
    let domain = url.hostname;

    // For now, consider all local packaged apps as safe.
    // tile:// pages are also safe because of their default CSP.
    if (
      domain.endsWith(".localhost") ||
      url.protocol === "tile:" ||
      url.protocol === "about:"
    ) {
      return;
    }

    let lang = navigator.language.split("-")[0];
    if (this.tosdrData == null) {
      try {
        let url = `http://shared.localhost:${window.config.port}/resources/tosdr_org.json`;
        let data = await fetch(url);
        this.tosdrData = await data.json();
      } catch (e) {
        console.error(`Failed to read tosdr_org.json: ${e}`);
        this.tosdrImg.src = "https://shields.tosdr.org/${lang}_0.svg";
        return;
      }
    }

    let itemId = this.tosdrData[domain];
    if (!itemId) {
      // Look for a less specific subdomain.
      // For instance www.lemonde.fr is not in tosdr but lemonde.fr is.
      let parts = domain.split(".");
      do {
        parts.splice(0, 1);
        itemId = this.tosdrData[parts.join(".")];
      } while (!itemId && parts.length >= 2);
    }

    this.tosdrImg.classList.remove("hidden");
    this.tosdrImg.src = `https://shields.tosdr.org/${lang}_${itemId || 0}.svg`;

    if (itemId) {
      this.tosdrImg.onclick = () => {
        this.close();
        window.wm.openFrame(`https://tosdr.org/${lang}/service/${itemId}`, {
          activate: true,
        });
      };
    } else {
      this.tosdrImg.onclick = null;
    }
  }

  async initSearchEngines() {
    if (this.searchEnginesReady) {
      return;
    }

    let menu = this.searchSection.querySelector("sl-menu");

    menu.addEventListener("sl-select", (event) => {
      let resource = event.detail.item.value;
      let desc = resource.variant("default").OpenSearchDescription;

      let urls = desc.Url;
      if (!Array.isArray(urls)) {
        urls = [urls];
      }
      let found = urls.find((item) => item._attributes.type == "text/html");
      if (!found) {
        return;
      }
      let template = found._attributes.template;
      let encoded = encodeURIComponent(this.state.search).replace(
        /[!'()*]/g,
        function (c) {
          return "%" + c.charCodeAt(0).toString(16);
        }
      );
      let url = template.replace("{searchTerms}", encoded);
      actionsDispatcher.dispatch("navigate-to", {
        url,
        search: this.state.search,
      });
      contentManager.visitPlace(url, true);
      this.close();
    });

    let openSearch = contentManager.getOpenSearchManager((items) => {
      menu.innerHTML = "";

      for (let item of items) {
        let json = item.variant("default").OpenSearchDescription;
        let menuItem = document.createElement("sl-menu-item");
        menuItem.value = item;
        menuItem.innerHTML = `<div class="name"></div>
        <img src="${item.variantUrl("icon")}" slot="prefix"/>`;

        menuItem.querySelector(".name").textContent =
          json.LongName?._text || json.ShortName?._text;

        menu.append(menuItem);
      }
    });
    await openSearch.init();
    this.searchEnginesReady = true;
  }

  async showSearchEngines() {
    let text = this.searchSection.querySelector("sl-button");

    let msg = await window.utils.l10n("site-info-search", {
      query: window.utils.truncateSearch(this.state.search),
    });
    text.textContent = msg;

    if (!this.searchEngines) {
      this.initSearchEngines();
    }

    this.searchSection.classList.remove("hidden");
  }

  async hideSearchEngines() {
    this.searchSection.classList.add("hidden");
  }

  inShadowRoot(selector) {
    return this.shadowRoot.querySelector(selector);
  }

  updateState(_name, state) {
    // console.log(`SiteInfo::updateState() ${JSON.stringify(state)}`);
    this.state = state;

    // Update the UA selector.
    let uaChooser = this.inShadowRoot(".ua-chooser");
    uaChooser.value = state.ua || "b2g";

    if (state.search) {
      this.showSearchEngines();
    } else {
      this.hideSearchEngines();
    }

    // If this is an about:reader url, get the original uri.
    if (state.url.startsWith("about:reader?url=")) {
      let url = new URL(state.url);
      this.state.url = url.searchParams.get("url");
    }

    // Update the UI.
    this.zoomLevel.textContent = `${(this.state.zoom * 100).toFixed(0)}%`;
    this.inShadowRoot(".title").textContent = this.state.title;
    this.inShadowRoot(".url").textContent = this.state.url;
    this.inShadowRoot(".favicon").src =
      this.state.icon || window.config.brandLogo;

    let goForward = this.inShadowRoot(".nav-forward");
    if (this.state.canGoForward) {
      goForward.classList.remove("disabled");
    } else {
      goForward.classList.add("disabled");
    }

    let goBack = this.inShadowRoot(".nav-back");
    if (this.state.canGoBack) {
      goBack.classList.remove("disabled");
    } else {
      goBack.classList.add("disabled");
    }

    // Update ReaderMode state.
    let readerMode = state.readerMode;
    if (readerMode) {
      if (readerMode.isArticle || readerMode.isReaderMode) {
        this.readerMode.classList.remove("hidden");
      } else {
        this.readerMode.classList.add("hidden");
      }

      if (readerMode.isReaderMode) {
        this.readerMode.classList.add("active");
      } else {
        this.readerMode.classList.remove("active");
      }
    }

    let splitScreen = this.inShadowRoot("sl-button.split-screen");
    if (state.splitScreen || embedder.sessionType === "mobile") {
      splitScreen.classList.add("hidden");
    } else {
      splitScreen.classList.remove("hidden");
    }

    this.updateTosdr();
  }

  open() {
    if (!this.state) {
      return;
    }

    actionsDispatcher.addListener("update-page-state", this.stateUpdater);

    ["nav-back", "nav-forward", "nav-reload", "zoom-in", "zoom-out"].forEach(
      (name) => {
        this.inShadowRoot(`.${name}`).onclick = (event) => {
          event.stopPropagation();
          event.preventDefault();
          this.dispatchEvent(new Event(name));
        };
      }
    );

    this.inShadowRoot(".share").onclick = () => {
      let shared = new WebActivity("share", {
        type: "url",
        url: this.state.url,
      });
      this.close();
      shared.start();
    };

    this.inShadowRoot("sl-button.split-screen").onclick = () => {
      this.close();
      actionsDispatcher.dispatch("frame-split-screen");
    };

    let button = this.inShadowRoot("sl-button.add-home");
    button.classList.remove("hidden");
    let pwaLogo = this.inShadowRoot("sl-button.add-home img");
    let label = this.inShadowRoot("sl-button.add-home span");
    if (this.state.manifestUrl && this.state.manifestUrl !== "") {
      pwaLogo.classList.remove("hidden");
      label.dataset.l10nId = "site-info-install-pwa";
    } else {
      pwaLogo.classList.add("hidden");
    }
    this.updateFavorite(button, label).then(() => {
      document.l10n.translateFragment(label);
    });
    button.onclick = async (event) => {
      event.stopPropagation();
      this.addToFavorites();
      this.close();
    };

    this.readerMode.onclick = () => {
      this.dispatchEvent(new Event("toggle-reader-mode"));
      this.close();
    };

    this.drawer.show();
  }

  async maybeAppForManifest(manifestUrl) {
    let service = await window.apiDaemon.getAppsManager();
    let app;
    try {
      // Check if the app is installed. getApp() expects the cached url, so instead
      // we need to get all apps and check their update url...
      let apps = await service.getAll();
      app = apps.find((app) => {
        return app.updateUrl == manifestUrl;
      });
    } catch (e) {}
    return app;
  }

  async updateFavorite(node, label) {
    let isFavorite = false;
    // If we have a manifest URL, check if the app is already installed.
    if (this.state.manifestUrl && this.state.manifestUrl !== "") {
      isFavorite = !!(await this.maybeAppForManifest(this.state.manifestUrl));
    } else if (URL.canParse(this.state.url)) {
      // Otherwise check if the current URL has a 'favorite' tag.
      let url = new URL(this.state.url);
      url.hash = "";

      let place = await contentManager.getPlace(url.href);

      let tags = place.meta.tags || [];
      isFavorite = tags.includes("favorite");
      if (isFavorite) {
        label.dataset.l10nId = "site-info-remove-favorite";
      } else {
        label.dataset.l10nId = "site-info-add-favorite";
      }
    }

    if (isFavorite) {
      node.classList.add("favorite");
    } else {
      node.classList.remove("favorite");
    }
  }

  async addToFavorites() {
    // If we have a manifest URL, check if the app is already installed.
    if (this.state.manifestUrl && this.state.manifestUrl !== "") {
      let app = await this.maybeAppForManifest(this.state.manifestUrl);
      if (!app) {
        // Install the new app.
        try {
          let service = await window.apiDaemon.getAppsManager();
          let appObject = await service.installPwa(this.state.manifestUrl);
          let msg = await window.utils.l10n("success-add-to-home");
          window.toaster.show(msg, "success");
          );
        } catch (e) {
          let msg = await window.utils.l10n("error-add-to-home");
          window.toaster.show(msg, "danger");
          console.error(
            `SiteInfo: Failed to install app: ${JSON.stringify(e)}`
          );
        }
      }
    } else if (URL.canParse(this.state.url)) {
      // Add the favorite tag if needed.
      let url = new URL(this.state.url);
      url.hash = "";

      let place = await contentManager.getPlace(url.href);
      let tags = place.meta.tags || [];
      if (!tags.includes("favorite")) {
        await place.addTag("favorite");

        let title = await window.utils.l10n("siteinfo-ask-add-to-home-title");
        let text = await window.utils.l10n("siteinfo-ask-add-to-home-text");
        let btnAdd = await window.utils.l10n("button-add");
        let btnCancel = await window.utils.l10n("button-cancel");

        let dialog = document.querySelector("confirm-dialog");
        let result = await dialog.open({
          title,
          text,
          buttons: [
            { id: "add", label: btnAdd, variant: "primary" },
            { id: "cancel", label: btnCancel },
          ],
          focused: "add",
        });
        if (result == "add") {
          this.addToHome({
            siteInfo: this.state,
          });
        }
      } else {
        await place.removeTag("favorite");
      }
    }
  }

  async addToHome(activityData) {
    let activity = new WebActivity("add-to-home", activityData);
    let start = Date.now();
    activity.start().then(
      async (result) => {
        let msg = await window.utils.l10n("success-add-to-home");
        window.toaster.show(msg, "success");
      },
      async (error) => {
        console.log(`SiteInfo: activity error is ${error}`);
        let msg = await window.utils.l10n("error-add-to-home");
        window.toaster.show(`${msg}: ${error}`, "danger");
      }
    );
  }

  setState(state) {
    // console.log(`SiteInfo::setState() ${JSON.stringify(state)}`);
    this.updateState(null, state);
  }
}

customElements.define("site-info", SiteInfo);
