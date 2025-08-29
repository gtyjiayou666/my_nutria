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
    // 立即初始化，确保启动时使用正确的样式
    this.initializeDesktopState();

    shadow.querySelector("#new-feature-icon").onclick = () => {
      this.drawer.hide();
      this.handleNewFeatureClick();
    };
  }

  async initializeDesktopState() {
    try {
      // 首次启动时，以 embedder.sessionType 为主
      const originalSessionType = embedder.sessionType;
      let savedDesktopState;
      let savedSessionType;
      
      console.log(`QuickSettings: Original embedder.sessionType: ${originalSessionType}`);
      
      // 从设置中读取保存的状态
      const settings = await apiDaemon.getSettings();
      
      try {
        const desktopResult = await settings.get("ui.desktop-mode");
        savedDesktopState = desktopResult.value;
        console.log(`QuickSettings: Loaded desktop state from settings: ${savedDesktopState}`);
      } catch (e) {
        savedDesktopState = null; // 设置不存在，表示首次启动
        console.log(`QuickSettings: No saved desktop state found (first startup)`);
      }
      
      try {
        const sessionResult = await settings.get("b2g.session-type");
        savedSessionType = sessionResult.value;
        console.log(`QuickSettings: Loaded session type from settings: ${savedSessionType}`);
      } catch (e) {
        savedSessionType = null; // 设置不存在，表示首次启动
        console.log(`QuickSettings: No saved session type found (first startup)`);
      }

      // 判断是否为首次启动
      const isFirstStartup = (savedDesktopState === null || savedSessionType === null);
      
      if (isFirstStartup) {
        // 首次启动：以 embedder.sessionType 为准
        console.log(`QuickSettings: First startup detected, using embedder.sessionType as primary source`);
        this.isDesktop = (originalSessionType === "desktop" || originalSessionType === "session");
        embedder.sessionType = originalSessionType; // 保持原值
        
        // 保存初始状态到设置
        try {
          await settings.set([
            { name: "ui.desktop-mode", value: this.isDesktop },
            { name: "b2g.session-type", value: originalSessionType }
          ]);
          console.log(`QuickSettings: Saved initial state - desktop: ${this.isDesktop}, sessionType: ${originalSessionType}`);
        } catch (e) {
          console.error(`QuickSettings: Failed to save initial state: ${e}`);
        }
      } else {
        // 非首次启动：使用保存的设置
        console.log(`QuickSettings: Using saved settings`);
        
        // 确保两个状态保持一致
        if ((savedDesktopState && savedSessionType !== "desktop" && savedSessionType !== "session") || 
            (!savedDesktopState && savedSessionType !== "mobile")) {
          // 以桌面状态为准，调整sessionType
          savedSessionType = savedDesktopState ? "desktop" : "mobile";
          console.log(`QuickSettings: Adjusted session type to match desktop state: ${savedSessionType}`);
        }

        this.isDesktop = savedDesktopState;
        
        // 同步设置 embedder.sessionType
        if (embedder.sessionType !== savedSessionType) {
          console.log(`QuickSettings: Updating embedder.sessionType from ${embedder.sessionType} to ${savedSessionType}`);
          embedder.sessionType = savedSessionType;
        }
      }

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

      console.log(`QuickSettings: Desktop state initialized to ${this.isDesktop}, sessionType: ${embedder.sessionType}`);
      
      // 根据初始桌面模式状态应用相应的样式和设置（标记为初始化）
      await this.applyDesktopModeSettings(this.isDesktop, embedder.sessionType, true);
      
      // 初始化完成后，发送当前桌面模式状态到homescreen
      console.log(`QuickSettings: Sending initial desktop state to homescreen: ${this.isDesktop}, sessionType: ${embedder.sessionType}`);
      actionsDispatcher.dispatch("desktop-mode-changed", { 
        isDesktop: this.isDesktop, 
        sessionType: embedder.sessionType 
      });
      
      // 发送初始的桌面模式状态
      setTimeout(() => {
        actionsDispatcher.dispatch("desktop-mode-changed", { 
          isDesktop: this.isDesktop, 
          sessionType: embedder.sessionType 
        });
        console.log(`QuickSettings: Sent initial desktop state: ${this.isDesktop}, sessionType: ${embedder.sessionType}`);
      }, 1000); // 延迟1秒，确保其他组件已经加载完成
    } catch (e) {
      console.error(`QuickSettings: Failed to initialize desktop state: ${e}`);
      // 发生错误时，回退到原始的 embedder.sessionType
      this.isDesktop = (embedder.sessionType === "desktop" || embedder.sessionType === "session");
      console.log(`QuickSettings: Error fallback - desktop: ${this.isDesktop}, sessionType: ${embedder.sessionType}`);
    }
  }

  // 应用桌面模式的设置和样式
  async applyDesktopModeSettings(isDesktop, sessionType, isInitializing = false) {
    console.log(`QuickSettings: Applying desktop mode settings - isDesktop: ${isDesktop}, sessionType: ${sessionType}, isInitializing: ${isInitializing}`);
    
    // 根据桌面模式状态控制虚拟键盘
    if (isDesktop) {
      // 桌面模式：禁用虚拟键盘
      console.log("QuickSettings: Setting up desktop mode - disabling virtual keyboard");
      Services.prefs.setBoolPref("dom.inputmethod.enabled", true);
      embedder.useVirtualKeyboard = false;
      // 如果当前有虚拟键盘打开，强制关闭
      if (window.inputMethod && window.inputMethod.opened) {
        window.inputMethod.close();
      }
    } else {
      // 移动模式：启用虚拟键盘
      console.log("QuickSettings: Setting up mobile mode - enabling virtual keyboard");
      Services.prefs.setBoolPref("dom.inputmethod.enabled", true);
      embedder.useVirtualKeyboard = true;
    }

    // 更新AppsList的桌面模式状态
    const appsList = document.querySelector('apps-list');
    if (appsList && typeof appsList.updateDesktopMode === 'function') {
      console.log(`QuickSettings: Updating apps-list desktop mode to ${isDesktop}`);
      appsList.updateDesktopMode(isDesktop);
    }

    // 切换壁纸
    if (window.wallpaperManager) {
      console.log(`QuickSettings: Switching wallpaper for isDesktop: ${isDesktop}`);
      window.wallpaperManager.switchWallpaper(isDesktop);
    }

    // 设置窗口大小
    let w = 0;
    let h = 0;
    if (!isDesktop) {
      h = window.screen.height;
      w = Math.min(h / 1.5, window.screen.width);
    } else {
      w = window.screen.width;
      h = window.screen.height;
    }

    console.log(`QuickSettings: Setting window size - w: ${w}, h: ${h}, isInitializing: ${isInitializing}`);
    
    // 设置窗口大小
    if (window.top) {
      const changeEvent = new CustomEvent("changeSize", {
        detail: {
          x: ((window.screen.width - w) / 2) | 0,
          y: 0,
          width: w,
          height: h
        }
      });
      
      if (isInitializing) {
        // 初始化时立即设置，无延迟
        window.top.dispatchEvent(changeEvent);
        console.log(`QuickSettings: Applied initial window size immediately`);
      } else {
        // 非初始化时保持原有的延迟逻辑
        setTimeout(() => {
          window.top.dispatchEvent(changeEvent);
        }, 300);
      }
    }

    console.log(`QuickSettings: Desktop mode settings applied successfully`);
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

    // 同步更新 embedder.sessionType
    // desktop模式对应 "desktop" sessionType，mobile模式对应 "mobile" sessionType
    const newSessionType = newIsDesktop ? "desktop" : "mobile";
    const oldSessionType = embedder.sessionType;
    
    console.log(`QuickSettings: Switching sessionType from ${oldSessionType} to ${newSessionType}`);
    embedder.sessionType = newSessionType;

    // 保存新状态到设置中，包括sessionType
    try {
      const settings = await apiDaemon.getSettings();
      await settings.set([
        { name: "ui.desktop-mode", value: newIsDesktop },
        { name: "b2g.session-type", value: newSessionType }
      ]);
      console.log(`QuickSettings: Saved desktop state (${newIsDesktop}) and session type (${newSessionType}) to settings`);
    } catch (e) {
      console.error(`QuickSettings: Failed to save desktop state and session type: ${e}`);
    }

    console.log(`Switching desktop mode from ${currentIsDesktop} to ${newIsDesktop}, sessionType: ${oldSessionType} -> ${newSessionType}`);

    // 发送桌面模式切换事件
    window.dispatchEvent(new CustomEvent('desktop-mode-changed', {
      detail: { isDesktop: newIsDesktop, sessionType: newSessionType }
    }));

    // 通过 actionsDispatcher 通知 homescreen 桌面模式切换
    console.log(`QuickSettings: Dispatching desktop-mode-changed event with isDesktop=${newIsDesktop}, sessionType=${newSessionType}`);
    actionsDispatcher.dispatch("desktop-mode-changed", { 
      isDesktop: newIsDesktop, 
      sessionType: newSessionType 
    });

    // 应用新的桌面模式设置（非初始化，保持动画）
    await this.applyDesktopModeSettings(newIsDesktop, newSessionType, false);

    // 获取窗口尺寸
    let w = 0;
    let h = 0;
    if (!newIsDesktop) {
      h = window.screen.height;
      w = Math.min(h / 1.5, window.screen.width);
    } else {
      w = window.screen.width;
      h = window.screen.height;
    }

    // 执行窗口大小变化动画
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
