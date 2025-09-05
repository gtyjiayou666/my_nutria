// Display panel management module.

class DisplayPanel {
  constructor() {
    this.log("constructor");
    this.panel = document.getElementById("display-panel");
    this.ready = false;
    this.panel.addEventListener("panel-ready", this);
    this.homescreen = null;
    this.resolution = null;
    this.theme = null;
    this.display = null;
    this.settings = null;
  }

  log(msg) {
    console.log(`DisplayPanel: ${msg}`);
  }

  error(msg) {
    console.error(`DisplayPanel: ${msg}`);
  }

  async handleEvent(event) {
    if (event.type === "panel-ready") {
      this.init();
    } else if (event.type === "sl-change") {
      this.updateChoice(event.target);
    } else if (event.type === "sl-select") {
      let kind = event.target.getAttribute("id");

      if (kind == "homescreens") {
        if (this.homescreen === event.detail.item) {
          this.homescreen.checked = true;
          return;
        }
        // Uncheck the "old" menu item.
        this.homescreen?.removeAttribute("checked");
        this.homescreen = event.detail.item;
        // Set the new settings value.
        let setting = {
          name: "homescreen.manifestUrl",
          value: this.homescreen.app.manifestUrl.href,
        };
        await this.settings.set([setting]);
      } else if (kind == "themes") {
        if (this.theme === event.detail.item) {
          this.theme.checked = true;
          return;
        }
        // Uncheck the "old" menu item.
        this.theme?.removeAttribute("checked");
        this.theme = event.detail.item;
        // Set the new settings value.
        let setting = {
          name: "nutria.theme",
          value: event.detail.item.dataset.theme,
        };
        await this.settings.set([setting]);
      } else if (kind == "resolutions") {
        if (this.resolution === event.detail.item) {
          this.resolution.checked = true;
          return;
        }
        // Uncheck the "old" menu item.
        this.resolution?.removeAttribute("checked");
        this.resolution = event.detail.item;
        // Set the new screen resolution.
        let type = await this.domRequestToPromise(navigator.b2g.b2GScreenManager.getDisplayType());
        this.setScreenResolution(this.display.dataset.num, type, event.detail.item.dataset.width, event.detail.item.dataset.height);
      } else if (kind == "displays") {
        if (this.display === event.detail.item) {
          this.display.checked = true;
          await this.setDisplay();
          return;
        }
        // Uncheck the "old" menu item.
        this.display?.removeAttribute("checked");
        this.display = event.detail.item;
        // Set the new display.
        await this.setDisplay();
      }
    } else if (event.type === "click") {
      // Handle resolution header click for collapse/expand
      if (event.target.id === "resolution-header" || event.target.closest("#resolution-header")) {
        this.toggleResolutionSection();
      } else if (event.target.id === "display-header" || event.target.closest("#display-header")) {
        this.toggleDisplaySection();
      }
    }
  }

  domRequestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result); // 成功时返回 result
      };
      request.onerror = () => {
        reject(request.error || new Error('DOMRequest failed'));
      };
    });
  }
  async updateChoice(item) {
    let settings = await apiDaemon.getSettings();
    await settings.set([
      {
        name: "ui.prefers.color-scheme",
        value: item.checked ? "dark" : "light",
      },
    ]);
  }

  async init() {
    if (this.ready) {
      return;
    }


    // The ui.prefers.color-scheme is set to "dark" when prefering a dark theme, any
    // other value select a light theme.
    this.settings = await apiDaemon.getSettings();
    let isDarkMode = false;
    try {
      let result = await this.settings.get("ui.prefers.color-scheme");
      isDarkMode = result.value === "dark";
    } catch (e) {
      this.log("Could not get color scheme setting, using default");
    }

    let modeSwitch = this.panel.querySelector("sl-switch");
    if (modeSwitch) {
      modeSwitch.checked = isDarkMode;
      modeSwitch.addEventListener("sl-change", this);
    } else {
      this.error("Dark mode switch not found!");
    }

    // Get the manifest url of the current homescreen from the setting.
    let port = location.port != 80 ? `:${location.port}` : "";
    let homescreenUrl = `http://homescreen.localhost${port}/manifest.webmanifest`;
    try {
      let result = await this.settings.get("homescreen.manifestUrl");
      homescreenUrl = result.value.replace("$PORT", port);
    } catch (e) { }

    // Get the manifest url of the current theme from the setting.
    let themeUrl;
    try {
      let result = await this.settings.get("nutria.theme");
      themeUrl = `http://${result.value}.localhost${port}/manifest.webmanifest`;
    } catch (e) { }

    // Get the list of homescreen and theme apps and populate the menus.
    let homescreens = document.getElementById("homescreens");
    let themes = document.getElementById("themes");

    if (!homescreens || !themes) {
      this.error("Homescreen or themes menu not found!");
      return;
    }
    let appsManager = await apiDaemon.getAppsManager();
    let apps = await appsManager.getAll();
    let homescreenCount = 0;
    let themeCount = 0;

    for (let app of apps) {
      // Fetch the manifest to check if the app role is "homescreen"
      let response = await fetch(app.manifestUrl);
      let manifest = await response.json();
      if (manifest.b2g_features?.role === "homescreen") {
        let item = document.createElement("sl-menu-item");
        item.setAttribute("type", "checkbox");
        item.textContent = manifest.description || manifest.name;
        item.app = app;
        if (homescreenUrl === app.manifestUrl.href) {
          item.setAttribute("checked", "true");
          this.homescreen = item;
        }
        homescreens.append(item);
        homescreenCount++;
      } else if (manifest.b2g_features?.role === "theme") {
        let item = document.createElement("sl-menu-item");
        item.setAttribute("type", "checkbox");
        item.textContent = manifest.description || manifest.name;
        item.dataset.theme = app.manifestUrl.host.split(".")[0];
        if (themeUrl === app.manifestUrl.href) {
          item.setAttribute("checked", "true");
          this.theme = item;
        }
        themes.append(item);
        themeCount++;
      }
    }

    homescreens.addEventListener("sl-select", this);
    themes.addEventListener("sl-select", this);

    // Initialize resolution, display  options
    await this.initDisplays();
    await this.initResolutions();

    // Add event listeners for headers click
    let resolutionHeader = this.panel.querySelector("#resolution-header");
    if (resolutionHeader) {
      resolutionHeader.addEventListener("click", this);
    }

    let displayHeader = this.panel.querySelector("#display-header");
    if (displayHeader) {
      displayHeader.addEventListener("click", this);
    }

    this.ready = true;

    // Ensure all dynamically created content is translated
    if (document.l10n) {
      try {
        await document.l10n.translateFragment(this.panel);
      } catch (error) {
        this.error(`Failed to apply final translation: ${error}`);
      }
    }
  }

  async initResolutions() {
    let resolutions = this.panel.querySelector("#resolutions");
    if (!resolutions) {
      this.error("Resolutions menu not found!");
      return;
    }

    // Clear existing content
    resolutions.innerHTML = "";

    try {
      // Get available resolutions from the backend
      let availableResolutions = await this.getAvailableResolutions();

      // Get current resolution
      let currentResolution = await this.getCurrentResolution();

      for (let res of availableResolutions) {
        let item = document.createElement("sl-menu-item");
        item.setAttribute("type", "checkbox");
        item.textContent = `${res.width} × ${res.height}`;
        item.dataset.width = res.width;
        item.dataset.height = res.height;

        // Check if this is the current resolution
        if (currentResolution && res.width === currentResolution.width && res.height === currentResolution.height) {
          item.setAttribute("checked", "true");
          this.resolution = item;
          currentResolution = null;
        }

        resolutions.append(item);
      }

      // Add event listener only once
      if (!resolutions.hasAttribute("data-listener-added")) {
        resolutions.addEventListener("sl-select", this);
        resolutions.setAttribute("data-listener-added", "true");
      }

    } catch (error) {
      this.error(`Failed to initialize resolutions: ${error}`);
    }
  }

  async getAvailableResolutions() {
    try {
      if (navigator.b2g && navigator.b2g.b2GScreenManager) {
        let resolutions = await this.domRequestToPromise(navigator.b2g.b2GScreenManager.getScreenResolutions(this.display.dataset.num));
        let availableResolutions = [];

        for (var i = 0; i < resolutions.length; i++) {
          availableResolutions.push({
            width: resolutions[i].width,
            height: resolutions[i].height
          });
        }

        return availableResolutions;
      }
    } catch (e) {
      this.error(`Failed to get available resolutions: ${e}`);
    }

    // Default resolutions if backend doesn't return any
    return [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1280, height: 720 },
      { width: 1024, height: 768 }
    ];
  }

  async getCurrentResolution() {
    try {
      if (navigator.b2g && navigator.b2g.b2GScreenManager) {
        return await this.domRequestToPromise(navigator.b2g.b2GScreenManager.getCurrentResolution(this.display.dataset.num));
      }
    } catch (e) {
      this.error(`Failed to get current resolution: ${e}`);
    }

    // Default resolution
    return { width: 1920, height: 1080 };
  }

  async initDisplays() {
    const displays = this.panel.querySelector("#displays");

    if (!displays) {
      this.error("Displays menu not found!");
      return;
    }

    try {
      // Clear existing display options
      displays.innerHTML = "";

      let displayCount = 1; // Default to 1 display
      if (navigator.b2g && navigator.b2g.b2GScreenManager) {
        displayCount = await this.domRequestToPromise(navigator.b2g.b2GScreenManager.getScreenNum());
      }
      for (let i = 0; i < displayCount; i++) {
        const item = document.createElement("sl-menu-item");
        item.setAttribute("type", "checkbox");
        item.dataset.num = i;

        // Create a span with l10n-id for "Display" text
        const span = document.createElement('span');
        span.setAttribute('data-l10n-id', 'display-monitor');
        span.textContent = 'Display'; // fallback text

        // Set the content as "Display X" where X is the display number
        item.appendChild(span);
        item.appendChild(document.createTextNode(` ${i + 1}`));

        if (i === 0) {
          item.setAttribute("checked", "true");
          this.display = item;
        }
        displays.appendChild(item);
      }

      // Translate the newly created elements
      if (document.l10n) {
        await document.l10n.translateFragment(displays);
      }

      // Add event listener only once
      if (!displays.hasAttribute("data-listener-added")) {
        displays.addEventListener("sl-select", this);
        displays.setAttribute("data-listener-added", "true");
      }

    } catch (error) {
      this.error(`Failed to initialize displays: ${error}`);
    }
  }

  async setDisplay() {
    await this.initResolutions();
  }

  toggleDisplaySection() {
    const header = this.panel.querySelector("#display-header");
    const content = this.panel.querySelector("#display-choose");
    const icon = header?.querySelector(".expand-icon");

    if (content && header) {
      const isCollapsed = content.style.display === "none" || !content.style.display;
      content.style.display = isCollapsed ? "block" : "none";

      if (icon) {
        icon.style.transform = isCollapsed ? "rotate(180deg)" : "rotate(0deg)";
      }
    }
  }

  setScreenResolution(displayNum, mode, width, height) {
    try {
      if (navigator.b2g && navigator.b2g.b2GScreenManager) {
        this.domRequestToPromise(navigator.b2g.b2GScreenManager.setResolution(displayNum, mode, parseInt(width), parseInt(height)));
      } else {
        this.error("b2GScreenManager not available");
      }
    } catch (e) {
      this.error(`Failed to set resolution: ${e}`);
    }
  }

  toggleResolutionSection() {
    const header = this.panel.querySelector("#resolution-header");
    const content = this.panel.querySelector("#resolution-choose");
    const icon = header?.querySelector(".expand-icon");

    if (content && header) {
      const isHidden = content.style.display === "none";
      content.style.display = isHidden ? "block" : "none";

      if (icon) {
        icon.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
      }

    }
  }

  toggleDisplaySection() {
    const header = this.panel.querySelector("#display-header");
    const content = this.panel.querySelector("#display-choose");
    const icon = header?.querySelector(".expand-icon");

    if (content && header) {
      const isHidden = content.style.display === "none";
      content.style.display = isHidden ? "block" : "none";

      if (icon) {
        icon.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
      }

    }
  }

}

const displayPanel = new DisplayPanel();
