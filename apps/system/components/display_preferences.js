// Display preferences component for system

class DisplayPreferences extends HTMLElement {
  constructor() {
    super();
    this.log("constructor");
    this.ready = false;
    this.homescreen = null;
    this.resolution = null;
    this.theme = null;
    this.settings = null;
  }

  log(msg) {
    console.log(`DisplayPreferences: ${msg}`);
  }

  error(msg) {
    console.error(`DisplayPreferences: ${msg}`);
  }

  connectedCallback() {
    let shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <link rel="stylesheet" href="components/display_preferences.css">
      <div class="container">
        <div class="header">
          <sl-icon name="monitor"></sl-icon>
          <h2 data-l10n-id="display-preferences-title">Display Preferences</h2>
          <sl-icon-button class="close-button" name="x" circle></sl-icon-button>
        </div>
        <div class="content">
          <div class="section">
            <div class="section-header">
              <sl-icon name="moon"></sl-icon>
              <span data-l10n-id="display-prefer-dark">Dark Mode</span>
              <sl-switch id="dark-mode-switch"></sl-switch>
            </div>
          </div>

          <div class="section">
            <div class="section-header">
              <sl-icon name="home"></sl-icon>
              <span data-l10n-id="display-choose-homescreen">Choose Homescreen</span>
            </div>
            <sl-menu id="homescreens"></sl-menu>
          </div>

          <div class="section">
            <div class="section-header">
              <sl-icon name="palette"></sl-icon>
              <span data-l10n-id="display-choose-theme">Choose Theme</span>
            </div>
            <sl-menu id="themes"></sl-menu>
          </div>

          <div class="section">
            <div class="section-header clickable" id="resolution-header">
              <sl-icon name="monitor"></sl-icon>
              <span data-l10n-id="display-choose-resolution">Screen Resolution</span>
              <sl-icon name="chevron-down" class="expand-icon"></sl-icon>
            </div>
            <sl-menu id="resolutions" class="collapsible hidden"></sl-menu>
          </div>
        </div>
      </div>
    `;

    this.container = shadow.querySelector('.container');
    this.closeButton = shadow.querySelector('.close-button');
    this.darkModeSwitch = shadow.querySelector('#dark-mode-switch');
    this.homescreens = shadow.querySelector('#homescreens');
    this.themes = shadow.querySelector('#themes');
    this.resolutions = shadow.querySelector('#resolutions');
    this.resolutionHeader = shadow.querySelector('#resolution-header');
    this.expandIcon = shadow.querySelector('.expand-icon');

    this.closeButton.addEventListener('click', () => this.close());
    this.darkModeSwitch.addEventListener('sl-change', this.updateDarkMode.bind(this));
    this.homescreens.addEventListener('sl-select', this.handleHomescreenSelect.bind(this));
    this.themes.addEventListener('sl-select', this.handleThemeSelect.bind(this));
    this.resolutions.addEventListener('sl-select', this.handleResolutionSelect.bind(this));
    this.resolutionHeader.addEventListener('click', this.toggleResolutionSection.bind(this));

    // Allow closing with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible()) {
        this.close();
      }
    });

    this.init();
  }

  async init() {
    if (this.ready) {
      return;
    }

    try {
      this.settings = await apiDaemon.getSettings();
      
      // Initialize dark mode
      await this.initDarkMode();
      
      // Initialize homescreen and theme options
      await this.initApps();
      
      // Initialize resolution options
      await this.initResolutions();
      
      this.ready = true;
    } catch (e) {
      this.error(`Failed to initialize: ${e}`);
    }
  }

  async initDarkMode() {
    let isDarkMode = false;
    try {
      let result = await this.settings.get("ui.prefers.color-scheme");
      isDarkMode = result.value === "dark";
    } catch (e) {}

    this.darkModeSwitch.checked = isDarkMode;
  }

  async initApps() {
    // Get the manifest url of the current homescreen from the setting.
    let port = location.port != 80 ? `:${location.port}` : "";
    let homescreenUrl = `http://homescreen.localhost${port}/manifest.webmanifest`;
    try {
      let result = await this.settings.get("homescreen.manifestUrl");
      homescreenUrl = result.value.replace("$PORT", port);
    } catch (e) {}

    // Get the manifest url of the current theme from the setting.
    let themeUrl;
    try {
      let result = await this.settings.get("nutria.theme");
      themeUrl = `http://${result.value}.localhost${port}/manifest.webmanifest`;
    } catch (e) {}

    // Get the list of homescreen and theme apps and populate the menus.
    let appsManager = await apiDaemon.getAppsManager();
    let apps = await appsManager.getAll();
    for (let app of apps) {
      try {
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
          this.homescreens.append(item);
        } else if (manifest.b2g_features?.role === "theme") {
          let item = document.createElement("sl-menu-item");
          item.setAttribute("type", "checkbox");
          item.textContent = manifest.description || manifest.name;
          item.dataset.theme = app.manifestUrl.host.split(".")[0];
          if (themeUrl === app.manifestUrl.href) {
            item.setAttribute("checked", "true");
            this.theme = item;
          }
          this.themes.append(item);
        }
      } catch (e) {
        this.error(`Failed to process app ${app.manifestUrl}: ${e}`);
      }
    }
  }

  async initResolutions() {
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
      
      this.resolutions.append(item);
    }
  }

  async getAvailableResolutions() {
    try {
      if (navigator.b2g && navigator.b2g.b2GScreenManager) {
        let resolutions = await navigator.b2g.b2GScreenManager.getScreenResolution();
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
        return await navigator.b2g.b2GScreenManager.getCurrentResolution();
      }
    } catch (e) {
      this.error(`Failed to get current resolution: ${e}`);
    }
    
    // Default resolution
    return { width: 1920, height: 1080 };
  }

  async setScreenResolution(width, height) {
    try {
      if (navigator.b2g && navigator.b2g.b2GScreenManager) {
        await navigator.b2g.b2GScreenManager.setScreenResolution(parseInt(width), parseInt(height));
        this.log(`Resolution changed to ${width}x${height}`);
      } else {
        this.error("b2GScreenManager not available");
      }
    } catch (e) {
      this.error(`Failed to set resolution: ${e}`);
    }
  }

  async updateDarkMode(event) {
    this.log(`dark mode = ${event.target.checked}`);
    await this.settings.set([
      {
        name: "ui.prefers.color-scheme",
        value: event.target.checked ? "dark" : "light",
      },
    ]);
  }

  async handleHomescreenSelect(event) {
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
  }

  async handleThemeSelect(event) {
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
  }

  async handleResolutionSelect(event) {
    if (this.resolution === event.detail.item) {
      this.resolution.checked = true;
      return;
    }
    // Uncheck the "old" menu item.
    this.resolution?.removeAttribute("checked");
    this.resolution = event.detail.item;
    // Set the new screen resolution.
    await this.setScreenResolution(event.detail.item.dataset.width, event.detail.item.dataset.height);
  }

  toggleResolutionSection() {
    const isHidden = this.resolutions.classList.contains('hidden');
    
    if (isHidden) {
      this.resolutions.classList.remove('hidden');
      this.expandIcon.setAttribute('name', 'chevron-up');
    } else {
      this.resolutions.classList.add('hidden');
      this.expandIcon.setAttribute('name', 'chevron-down');
    }
  }

  show() {
    this.style.display = 'block';
    this.classList.add('visible');
    document.body.classList.add('display-preferences-open');
  }

  close() {
    this.classList.remove('visible');
    document.body.classList.remove('display-preferences-open');
    setTimeout(() => {
      this.style.display = 'none';
    }, 300);
  }

  isVisible() {
    return this.classList.contains('visible');
  }
}

customElements.define("display-preferences", DisplayPreferences);
