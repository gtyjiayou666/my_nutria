// Display preferences component for system

class DisplayPreferences extends HTMLElement {
  constructor() {
    super();
    this.log("constructor");
    this.ready = false;
    this.homescreen = null;
    this.display = null;
    this.resolution = null;
    this.theme = null;
    this.extension = null;
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
          <h2 data-l10n-id="display-title"></h2>
          <sl-icon-button class="close-button" name="x" circle></sl-icon-button>
        </div>
        <div class="content">
          <div class="section">
            <div class="section-header">
              <sl-icon name="moon"></sl-icon>
              <span data-l10n-id="display-prefer-dark"></span>
              <sl-switch id="dark-mode-switch"></sl-switch>
            </div>
          </div>

          <div class="section">
            <div class="section-header">
              <sl-icon name="home"></sl-icon>
              <span data-l10n-id="display-choose-homescreen"></span>
            </div>
            <sl-menu id="homescreens"></sl-menu>
          </div>

          <div class="section">
            <div class="section-header">
              <sl-icon name="palette"></sl-icon>
              <span data-l10n-id="display-choose-theme"></span>
            </div>
            <sl-menu id="themes"></sl-menu>
          </div>

          <div class="section">
            <div class="section-header clickable" id="display-header">
              <sl-icon name="monitor"></sl-icon>
              <span data-l10n-id="display-choose"></span>
              <sl-icon name="chevron-down" class="expand-icon-display"></sl-icon>
            </div>
            <sl-menu id="displays" class="collapsible hidden"></sl-menu>
          </div>

          <div class="section">
            <div class="section-header clickable" id="resolution-header">
              <sl-icon name="monitor"></sl-icon>
              <span data-l10n-id="display-choose-resolution"></span>
              <sl-icon name="chevron-down" class="expand-icon-resolution"></sl-icon>
            </div>
            <sl-menu id="resolutions" class="collapsible hidden"></sl-menu>
          </div>

          <div class="section">
            <div class="section-header">
              <sl-icon name="palette"></sl-icon>
              <span data-l10n-id="display-choose-extension"></span>
            </div>
            <sl-menu id="extensions"></sl-menu>
          </div>

        </div>
      </div>
    `;
    document.l10n.translateFragment(shadow);
    this.container = shadow.querySelector('.container');
    this.closeButton = shadow.querySelector('.close-button');
    this.darkModeSwitch = shadow.querySelector('#dark-mode-switch');
    this.homescreens = shadow.querySelector('#homescreens');
    this.themes = shadow.querySelector('#themes');
    this.extensions = shadow.querySelector('#extensions');
    this.displays = shadow.querySelector('#displays');
    this.displayHeader = shadow.querySelector('#display-header');
    this.resolutions = shadow.querySelector('#resolutions');
    this.resolutionHeader = shadow.querySelector('#resolution-header');
    this.expandIconDisplay = shadow.querySelector('.expand-icon-display');
    this.expandIcon = shadow.querySelector('.expand-icon-resolution');

    this.closeButton.addEventListener('click', () => this.close());
    this.darkModeSwitch.addEventListener('sl-change', this.updateDarkMode.bind(this));
    this.homescreens.addEventListener('sl-select', this.handleHomescreenSelect.bind(this));
    this.themes.addEventListener('sl-select', this.handleThemeSelect.bind(this));
    this.extensions.addEventListener('sl-select', this.handleExtensionSelect.bind(this));
    this.displays.addEventListener('sl-select', this.handleDisplaySelect.bind(this));
    this.displayHeader.addEventListener('click', this.toggleDisplaySection.bind(this));
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

      await this.initDisplays();
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
    } catch (e) { }

    this.darkModeSwitch.checked = isDarkMode;
  }

  async initApps() {
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

    let item = document.createElement("sl-menu-item");
    item.setAttribute("type", "checkbox");
    item.textContent = "project";
    item.dataset.extension = 0;
    item.setAttribute("checked", "true");
    this.extension = item;
    this.extensions.append(item);
    item = document.createElement("sl-menu-item");
    item.setAttribute("type", "checkbox");
    item.textContent = "extend";
    item.dataset.extension = 1;
    this.extensions.append(item);
  }

  async initDisplays() {
    // Get available resolutions from the backend
    let availableDisplays = await this.getAvailableDisplays();

    // Get current resolution
    let currentDisplay = availableDisplays[0];

    for (let res of availableDisplays) {
      let item = document.createElement("sl-menu-item");
      item.setAttribute("type", "checkbox");
      item.textContent = `${res}`;
      item.dataset.num = res;

      // Check if this is the current resolution
      if (currentDisplay != null && res === currentDisplay) {
        item.setAttribute("checked", "true");
        this.display = item;
        currentDisplay = null;
      }

      this.displays.append(item);
    }
  }

  async initResolutions() {
    // Get available resolutions from the backend
    let availableResolutions = await this.getAvailableResolutions(this.display.dataset.num);
    this.resolutions.innerHTML = '';
    // Get current resolution
    // let currentResolution = await this.getCurrentResolution();
    if (navigator.b2g && navigator.b2g.b2GScreenManager) {
      let currentResolution = await navigator.b2g.b2GScreenManager.getCurrentResolution(this.display.dataset.num);
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
        this.resolutions.append(item);
      }
    }
  }

  async getAvailableDisplays() {
    try {
      if (navigator.b2g && navigator.b2g.b2GScreenManager) {
        let num = await navigator.b2g.b2GScreenManager.getScreenNum();
        let availableDisplays = [];

        for (var i = 0; i < num; i++) {
          availableDisplays.push(i);
        }

        return availableDisplays;
      }
    } catch (e) {
      this.error(`Failed to get available resolutions: ${e}`);
    }

    // Default resolutions if backend doesn't return any
    return [0];
  }

  async getAvailableResolutions(screen) {
    try {
      if (navigator.b2g && navigator.b2g.b2GScreenManager) {
        let resolutions = await navigator.b2g.b2GScreenManager.getScreenResolutions(screen);
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

  async setDisplay() {
    await this.initResolutions();
  }

  async setScreenResolution(screen, width, height) {
    try {
      if (navigator.b2g && navigator.b2g.b2GScreenManager) {
        this.close();
        const overlay = document.getElementById("blackOverlay");
        overlay.style.display = "block";
        overlay.style.opacity = "1"
        window.top.dispatchEvent(new CustomEvent("changeSize", {
          detail: {
            x: 0,
            y: 0,
            width: 1,
            height: 1
          }
        }));
        let pos = await navigator.b2g.b2GScreenManager.setResolution(screen, this.extension.dataset.extension, parseInt(width), parseInt(height));
        setTimeout(() => {
          if (pos.x != -1) {
            window.top.dispatchEvent(new CustomEvent("changeSize", {
              detail: {
                x: pos.x,
                y: pos.y,
                width: pos.width,
                height: pos.height
              }
            }));
          } else {
            window.top.dispatchEvent(new CustomEvent("changeSize", {
              detail: {
                x: 0,
                y: 0,
                width: window.screen.width,
                height: window.screen.height
              }
            }));
          }
          setTimeout(() => {
            this.show();
            overlay.style.opacity = "0";
            overlay.style.display = "none";
          }, 100);
        }, 300);
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

  async handleExtensionSelect(event) {
    if (this.extension === event.detail.item) {
      this.extension.checked = true;
      return;
    }
    // Uncheck the "old" menu item.
    this.extension?.removeAttribute("checked");
    this.extension = event.detail.item;
    // Set the new settings value.
    await this.setScreenResolution(this.display.dataset.num, this.resolution.dataset.width, this.resolution.dataset.height);
  }

  async handleDisplaySelect(event) {
    if (this.display === event.detail.item) {
      this.display.checked = true;
      return;
    }
    // Uncheck the "old" menu item.
    this.display?.removeAttribute("checked");
    this.display = event.detail.item;
    // Set the new screen resolution.
    await this.setDisplay();
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
    await this.setScreenResolution(this.display.dataset.num, event.detail.item.dataset.width, event.detail.item.dataset.height);
  }

  async toggleDisplaySection() {
    this.displays.innerHTML = '';
    await this.initDisplays();
    const isHidden = this.displays.classList.contains('hidden');

    if (isHidden) {
      this.displays.classList.remove('hidden');
      this.expandIconDisplay.setAttribute('name', 'chevron-up');
    } else {
      this.displays.classList.add('hidden');
      this.expandIconDisplay.setAttribute('name', 'chevron-down');
    }
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
    this.style.display = 'none';
  }

  isVisible() {
    return this.classList.contains('visible');
  }
}

customElements.define("display-preferences", DisplayPreferences);
