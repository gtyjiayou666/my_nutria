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
    this.extension = null;
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
      console.log(`nutria.theme ${event.target.getAttribute("id")}`);
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
        console.log(`nutria.theme: will switch to ${event.detail.item.dataset.theme}`);
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
        await this.setScreenResolution(this.display.dataset.num, event.detail.item.dataset.width, event.detail.item.dataset.height);
      } else if (kind == "displays") {
        if (this.display === event.detail.item) {
          this.display.checked = true;
          return;
        }
        // Uncheck the "old" menu item.
        this.display?.removeAttribute("checked");
        this.display = event.detail.item;
        // Set the new display.
        await this.setDisplay();
      } else if (kind == "extensions") {
        if (this.extension === event.detail.item) {
          this.extension.checked = true;
          return;
        }
        // Uncheck the "old" menu item.
        this.extension?.removeAttribute("checked");
        this.extension = event.detail.item;
        // Set the new extension mode.
        await this.setScreenResolution(this.display.dataset.num, this.resolution.dataset.width, this.resolution.dataset.height);
      }
    } else if (event.type === "click") {
      // Handle resolution header click for collapse/expand
      if (event.target.id === "resolution-header" || event.target.closest("#resolution-header")) {
        this.toggleResolutionSection();
      } else if (event.target.id === "display-header" || event.target.closest("#display-header")) {
        this.toggleDisplaySection();
      } else if (event.target.id === "extension-header" || event.target.closest("#extension-header")) {
        this.toggleExtensionSection();
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
    this.log(`dark mode = ${item.checked}`);
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
    } catch (e) { }

    let modeSwitch = this.panel.querySelector("sl-switch");
    modeSwitch.checked = isDarkMode;
    modeSwitch.addEventListener("sl-change", this);

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

    let appsManager = await apiDaemon.getAppsManager();
    let apps = await appsManager.getAll();
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
      }
    }
    homescreens.addEventListener("sl-select", this);
    themes.addEventListener("sl-select", this);
    
    // Add event listeners for new menus
    let resolutions = this.panel.querySelector("#resolutions");
    if (resolutions) {
      resolutions.addEventListener("sl-select", this);
    }
    
    let displays = this.panel.querySelector("#displays");
    if (displays) {
      displays.addEventListener("sl-select", this);
    }
    
    let extensions = this.panel.querySelector("#extensions");
    if (extensions) {
      extensions.addEventListener("sl-select", this);
    }

    // Initialize resolution options
    await this.initResolutions();
    await this.initDisplays();
    await this.initExtensions();
    
    // Add event listeners for headers click
    let resolutionHeader = this.panel.querySelector("#resolution-header");
    if (resolutionHeader) {
      resolutionHeader.addEventListener("click", this);
    }
    
    let displayHeader = this.panel.querySelector("#display-header");
    if (displayHeader) {
      displayHeader.addEventListener("click", this);
    }
    
    let extensionHeader = this.panel.querySelector("#extension-header");
    if (extensionHeader) {
      extensionHeader.addEventListener("click", this);
    }

    this.ready = true;
  }

  async initResolutions() {
    let resolutions = this.panel.querySelector("#resolutions");
    if (!resolutions) {
      return;
    }
    
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
      }
      
      resolutions.append(item);
    }
    
    resolutions.addEventListener("sl-select", this);
  }

  async getAvailableResolutions() {
    try {
      if (navigator.b2g && navigator.b2g.b2GScreenManager) {
        let resolutions = await this.domRequestToPromise(navigator.b2g.b2GScreenManager.getScreenResolutions(0));
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
        return await this.domRequestToPromise(navigator.b2g.b2GScreenManager.getCurrentResolution(0));
      }
    } catch (e) {
      this.error(`Failed to get current resolution: ${e}`);
    }
    
    // Default resolution
    return { width: 1920, height: 1080 };
  }

  async initDisplays() {
    try {
      const displays = this.panel.querySelector("#displays");
      
      if (!displays) return;
      
      // Clear existing display options
      displays.innerHTML = "";
      
      const displayCount = 1; // Default to 1 display
      
      for (let i = 0; i < displayCount; i++) {
        const item = document.createElement("sl-menu-item");
        item.setAttribute("type", "checkbox");
        item.dataset.num = i;
        item.textContent = `Display ${i + 1}`;
        if (i === 0) {
          item.setAttribute("checked", "");
          this.display = item;
        }
        displays.appendChild(item);
      }
    } catch (error) {
      console.error("Failed to initialize displays:", error);
    }
  }

  async initExtensions() {
    try {
      const extensions = this.panel.querySelector("#extensions");
      
      if (!extensions) return;
      
      // Clear existing extension options
      extensions.innerHTML = "";
      
      const extensionModes = ["None", "Extended", "Mirror"];
      
      extensionModes.forEach((ext, index) => {
        const item = document.createElement("sl-menu-item");
        item.setAttribute("type", "checkbox");
        item.dataset.mode = ext.toLowerCase();
        item.textContent = ext;
        if (index === 0) {
          item.setAttribute("checked", "");
          this.extension = item;
        }
        extensions.appendChild(item);
      });
    } catch (error) {
      console.error("Failed to initialize extensions:", error);
    }
  }

  async setDisplay() {
    try {
      // Update display-related settings here
      console.log("Setting display:", this.display?.dataset.num);
    } catch (error) {
      console.error("Failed to set display:", error);
    }
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

  toggleExtensionSection() {
    const header = this.panel.querySelector("#extension-header");
    const content = this.panel.querySelector("#extension-choose");
    const icon = header?.querySelector(".expand-icon");
    
    if (content && header) {
      const isCollapsed = content.style.display === "none" || !content.style.display;
      content.style.display = isCollapsed ? "block" : "none";
      
      if (icon) {
        icon.style.transform = isCollapsed ? "rotate(180deg)" : "rotate(0deg)";
      }
    }
  }

  async setScreenResolution(displayNum, width, height) {
    try {
      if (navigator.b2g && navigator.b2g.b2GScreenManager) {
        await this.domRequestToPromise(navigator.b2g.b2GScreenManager.setResolution(0, 0, parseInt(width), parseInt(height)));
        this.log(`Resolution changed to ${width}x${height}`);
      } else {
        this.error("b2GScreenManager not available");
      }
    } catch (e) {
      this.error(`Failed to set resolution: ${e}`);
    }
  }

  toggleResolutionSection() {
    const resolutions = this.panel.querySelector("#resolutions");
    const expandIcon = this.panel.querySelector(".expand-icon");
    
    if (!resolutions || !expandIcon) {
      return;
    }
    
    const isHidden = resolutions.classList.contains('hidden');
    
    if (isHidden) {
      resolutions.classList.remove('hidden');
      expandIcon.style.transform = 'rotate(180deg)';
    } else {
      resolutions.classList.add('hidden');
      expandIcon.style.transform = 'rotate(0deg)';
    }
  }
}

const displayPanel = new DisplayPanel();
