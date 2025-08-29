// Components used for the apps list view.
// The <action-bookmark> custom element.

// Similar component to the homescreen's ActionBookmark.
class AppIcon extends HTMLElement {
  constructor(data) {
    super();
    this.init(data);
    
    // 双击相关属性
    this.lastClickTime = 0;
    this.doubleClickDelay = 300; // 300ms内的第二次点击视为双击
    this.clickTimeout = null;
  }

  // data = { icon, title, url }
  init(data) {
    this.data = data;
    this.icon =
      typeof data.icon == "string" ||
      Object.getPrototypeOf(data.icon) === URL.prototype
        ? data.icon
        : URL.createObjectURL(data.icon);
  }

  connectedCallback() {
    let data = this.data;
    let shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <link rel="stylesheet" href="components/app_icon.css">
      <img src="${this.icon}" alt="${data.title}"></img>
      <span>${data.title}</span>
      `;

    // 移除简单的onclick，使用更复杂的点击处理
    this.addEventListener('click', this.handleClick.bind(this));
    
    // 检查并应用桌面模式样式
    this.updateDesktopMode();
    
    // 监听桌面模式变化
    window.addEventListener('desktop-mode-changed', () => {
      this.updateDesktopMode();
    });
  }
  
  // 更新桌面模式样式
  updateDesktopMode() {
    if (this.isDesktopMode()) {
      this.classList.add('desktop-mode');
    } else {
      this.classList.remove('desktop-mode');
    }
  }
  
  // 检查是否为桌面模式
  isDesktopMode() {
    // 检查父级AppsList的桌面模式状态
    const appsList = this.closest('apps-list');
    if (appsList) {
      return appsList.classList.contains('desktop-mode');
    }
    
    // 检查 QuickSettings 的状态
    const quickSettings = document.querySelector('quick-settings');
    if (quickSettings && typeof quickSettings.isDesktop !== 'undefined') {
      return quickSettings.isDesktop;
    }
    
    // 检查 wallpaperManager
    if (window.wallpaperManager && typeof window.wallpaperManager.isDesktop !== 'undefined') {
      return window.wallpaperManager.isDesktop;
    }
    
    // 默认为桌面模式
    return true;
  }
  
  handleClick(event) {
    event.preventDefault();
    
    // 检查是否在应用列表中
    const isInAppsList = this.closest('apps-list') !== null;
    
    if (this.isDesktopMode() && !isInAppsList) {
      // 桌面模式且不在应用列表中：双击打开应用（桌面图标行为）
      const now = Date.now();
      const timeSinceLastClick = now - this.lastClickTime;
      
      console.log(`AppIcon desktop mode click: timeSinceLastClick=${timeSinceLastClick}, doubleClickDelay=${this.doubleClickDelay}`);
      
      if (timeSinceLastClick < this.doubleClickDelay && this.lastClickTime > 0) {
        // 双击检测到，立即打开应用
        console.log('AppIcon double-click detected in desktop mode - opening application');
        if (this.clickTimeout) {
          clearTimeout(this.clickTimeout);
          this.clickTimeout = null;
        }
        this.openApplication();
        this.lastClickTime = 0; // 重置点击时间
      } else {
        // 第一次点击或时间间隔太长，等待可能的第二次点击
        console.log('AppIcon first click in desktop mode - waiting for potential double-click');
        this.lastClickTime = now;
        
        // 清除之前的timeout
        if (this.clickTimeout) {
          clearTimeout(this.clickTimeout);
        }
        
        this.clickTimeout = setTimeout(() => {
          // 单击处理（在桌面模式下显示选中效果）
          console.log('AppIcon single-click timeout - highlighting app');
          this.highlightApp();
          this.clickTimeout = null;
          this.lastClickTime = 0; // 重置点击时间，为下次双击做准备
        }, this.doubleClickDelay);
      }
    } else {
      // 移动模式或在应用列表中：单击直接打开应用
      console.log(`AppIcon ${isInAppsList ? 'in apps-list' : 'mobile mode'} click - opening application immediately`);
      this.openApplication();
    }
  }
  
  openApplication() {
    console.log(`AppIcon: Opening application in ${this.isDesktopMode() ? 'desktop' : 'mobile'} mode`);
    this.dispatchEvent(
      new CustomEvent("open-bookmark", {
        bubbles: true,
        detail: {
          url: this.data.url,
          title: this.data.title,
          icon: this.icon,
          backgroundColor: this.data.backgroundColor,
        },
      })
    );
  }
  
  highlightApp() {
    // 先清除所有其他应用的高亮
    const appsList = this.closest('apps-list');
    if (appsList) {
      appsList.querySelectorAll('app-icon').forEach(icon => {
        if (icon !== this) {
          icon.classList.remove('selected');
        }
      });
    }
    
    // 高亮当前应用
    this.classList.add('selected');
    console.log('AppIcon: Application highlighted');
    
    // 3秒后自动取消高亮
    setTimeout(() => {
      this.classList.remove('selected');
    }, 3000);
  }

  disconnectedCallback() {
    if (this.icon.startsWith("blob")) {
      URL.revokeObjectURL(this.icon);
    }
  }
}

customElements.define("app-icon", AppIcon);

class AppsList extends LitElement {
  constructor() {
    super();

    this.appsNodes = [];

    window.appsManager.addEventListener("app-installed", this);
    window.appsManager.addEventListener("app-uninstalled", this);

    this.contextMenuOpen = false;
    this.contextMenuHandler = this.captureContextMenuEvent.bind(this);
    this.buildAppsNodes();
    
    // 绑定全局点击处理器
    this.globalClickHandler = this.handleGlobalClick.bind(this);
    
    // 监听桌面模式状态变化
    this.initializeDesktopMode();
  }

  static get properties() {
    return {
      appsNodes: { state: true },
    };
  }

  log(msg) {
    console.log(`AppsList: ${msg}`);
  }

  initializeDesktopMode() {
    // 监听桌面模式状态变化
    window.addEventListener('desktop-mode-changed', (event) => {
      this.updateDesktopMode(event.detail.isDesktop);
    });
    
    // 初始状态检查
    // 从QuickSettings获取当前桌面模式状态
    const quickSettings = document.querySelector('quick-settings');
    if (quickSettings && typeof quickSettings.isDesktop !== 'undefined') {
      this.updateDesktopMode(quickSettings.isDesktop);
    } else {
      // 如果QuickSettings还未初始化，等待其准备就绪
      window.addEventListener('quick-settings-connected', () => {
        const quickSettings = document.querySelector('quick-settings');
        if (quickSettings && typeof quickSettings.isDesktop !== 'undefined') {
          this.updateDesktopMode(quickSettings.isDesktop);
        }
      });
    }
  }

  updateDesktopMode(isDesktop) {
    console.log(`AppsList: Updating desktop mode to ${isDesktop}`);
    if (isDesktop) {
      this.classList.add('desktop-mode');
    } else {
      this.classList.remove('desktop-mode');
    }
    
    // 更新所有子应用图标的桌面模式样式
    this.updateChildren();
  }
  
  // 更新所有子元素的桌面模式样式
  updateChildren() {
    this.appsNodes.forEach(appIcon => {
      if (appIcon && typeof appIcon.updateDesktopMode === 'function') {
        appIcon.updateDesktopMode();
      }
    });
  }

  handleGlobalClick(event) {
    // 检查点击是否在 apps-list 元素内部
    if (!this.contains(event.target)) {
      // 检查是否点击了开始按钮或快速启动按钮，如果是则不关闭
      const target = event.target;
      const isStartButton = target.closest('[data-l10n-id="quickstart"]') || 
                           target.closest('.start-button') ||
                           target.closest('quicklaunch-button');
      
      if (!isStartButton) {
        event.preventDefault();
        event.stopPropagation();
        this.close();
      }
    }
  }

  open() {
    // If carousel is open, close it first
    if (window.wm.isCarouselOpen) {
      actionsDispatcher.dispatch("close-carousel");
    }

    this.canOpen = false;
    
    // 为桌面模式添加备用计时器
    const setCanOpenFallback = setTimeout(() => {
      if (!this.canOpen) {
        console.log('AppsList: Setting canOpen to true via fallback timer');
        this.canOpen = true;
      }
    }, 500); // 500ms后强制设置canOpen为true
    
    this.addEventListener(
      "transitionend",
      () => {
        console.log('AppsList: Setting canOpen to true via transitionend');
        this.canOpen = true;
        clearTimeout(setCanOpenFallback); // 清除备用计时器
      },
      { once: true }
    );
    this.classList.add("open");

    // 检查是否为桌面模式
    const isDesktopMode = this.classList.contains('desktop-mode');
    
    if (!isDesktopMode) {
      // 移动模式：保持原有行为，显示桌面背景
      // Ensure we always show the homescreen as background with wallpaper visible
      window.wm.goHomeInstant();
      // Make sure only homescreen is visible as background
      window.wm.ensureActiveFrameVisibility();
      // Hide the homescreen content to show only the wallpaper
      let homescreenFrame = window.wm.homescreenFrame();
      if (homescreenFrame) {
        homescreenFrame.classList.add("deactivated");
        // Force wallpaper to be visible by ensuring no content windows are showing
        homescreenFrame.style.background = "transparent";
      }
    } else {
      // 桌面模式：不切换到桌面，保持当前应用可见
      console.log('AppsList: Desktop mode - not switching to homescreen, keeping current app visible');
    }
    
    this.focus();
    embedder.addSystemEventListener("keypress", this, true);
    
    // 添加全局点击监听器，延迟添加以避免立即触发
    setTimeout(() => {
      document.addEventListener("click", this.globalClickHandler, true);
    }, 100);
  }

  close() {
    embedder.removeSystemEventListener("keypress", this, true);
    this.closeContextMenu();
    this.classList.remove("open");
    
    // 检查是否为桌面模式
    const isDesktopMode = this.classList.contains('desktop-mode');
    
    if (!isDesktopMode) {
      // 移动模式：恢复homescreen的内容可见性
      // Restore the homescreen content visibility
      let homescreenFrame = window.wm.homescreenFrame();
      if (homescreenFrame) {
        homescreenFrame.classList.remove("deactivated");
        homescreenFrame.style.background = "";
      }
    } else {
      // 桌面模式：不需要恢复homescreen，保持当前应用可见
      console.log('AppsList: Desktop mode - not restoring homescreen, keeping current app visible');
    }
    
    // 移除全局点击监听器
    document.removeEventListener("click", this.globalClickHandler, true);
  }

  toggle() {
    if (this.classList.contains("open")) {
      this.close();
    } else {
      this.open();
    }
  }

  async handleEvent(event) {
    switch (event.type) {
      case "open-bookmark":
        console.log(`AppsList: Received open-bookmark event. canOpen=${this.canOpen}, wm exists=${!!window.wm}`);
        if (this.canOpen) {
          console.log(`AppsList: Opening frame for URL: ${event.detail.url}`);
          window.wm.openFrame(event.detail.url, {
            activate: true,
            details: event.detail,
          });
          this.close();
        } else {
          console.log('AppsList: Cannot open - canOpen is false');
        }
        break;
      case "contextmenu":
         //console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
        event.preventDefault();
        this.openContextMenu(event, event.target.data);
        break;
      case "app-installed":
      case "app-uninstalled":
        await this.buildAppsNodes();
        break;
      case "keypress":
        if (event.key === "Escape") {
          this.close();
        }
        break;
    }
  }

  async buildAppsNodes() {
    let apps = await window.appsManager.getAll();
    let appsNodes = [];
    for (let app of apps) {
      let summary = await window.appsManager.getSummary(app);
      const isTile = summary.url?.startsWith("tile://");
      if (
        (!summary.role ||
          !["system", "homescreen", "input", "theme"].includes(summary.role)) &&
        !isTile
      ) {
        let node = new AppIcon(summary);
        node.app = app;
        node.addEventListener("contextmenu", this);
        node.addEventListener("open-bookmark", this);
        appsNodes.push(node);
      }
    }

    // Sort the nodes to get consistent ordering of the apps.
    this.appsNodes = appsNodes.sort((a, b) => {
      return a.data.title.toLowerCase() > b.data.title.toLowerCase();
    });
  }

  captureContextMenuEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    this.closeContextMenu();
  }

  openContextMenu(event, data) {
    let menu = this.shadowRoot.querySelector(".menu");
    menu.querySelector("sl-menu-item[disabled]").textContent = data.title;
    menu.classList.add("hidden");

    menu.app = event.target.app;
    // console.log(menu.app);

    let showContextMenu = false;
    this.contextMenuOpen = false;

    if (!menu.app.removable) {
      menu.querySelector("#uninstall-option").classList.add("hidden");
    } else {
      menu.querySelector("#uninstall-option").classList.remove("hidden");
      showContextMenu = true;
    }

    let targetRect = event.target.getBoundingClientRect();

    window.XacHomescreen.isAppInHomescreen(menu.app.manifestUrl.href).then(
      (result) => {
        if (result) {
          menu.querySelector("#add-to-home-option").classList.add("hidden");
        } else {
          menu.querySelector("#add-to-home-option").classList.remove("hidden");
          showContextMenu = true;
        }

        if (showContextMenu) {
          menu.classList.remove("hidden");

          // Position the context menu over the target icon.
          let menuRect = menu.getBoundingClientRect();
          let thisRect = this.getBoundingClientRect();

          let left =
            targetRect.x -
            thisRect.x +
            targetRect.width / 2 -
            menuRect.width / 2;
          let top = targetRect.y - thisRect.y + targetRect.height / 2;

          if (left + menuRect.width > thisRect.width) {
            left = thisRect.width - menuRect.width - 10;
          }

          if (left < thisRect.x) {
            left = 10;
          }

          if (top + menuRect.height > thisRect.height) {
            top = thisRect.height - menuRect.height - 10;
          }

          if (top < thisRect.y) {
            top = 10;
          }

          menu.style.left = `${left}px`;
          menu.style.top = `${top}px`;

          // Intercept pointerdown on the main container.
          let container = this.shadowRoot.querySelector(".container");
          container.addEventListener("click", this.contextMenuHandler, {
            capture: true,
          });

          this.contextMenuOpen = true;
        }
      }
    );
  }

  closeContextMenu() {
    if (!this.contextMenuOpen) {
      return;
    }

    let container = this.shadowRoot.querySelector(".container");
    container.removeEventListener("click", this.contextMenuHandler, {
      capture: true,
    });

    let menu = this.shadowRoot.querySelector(".menu");
    menu.classList.add("hidden");
    this.contextMenuOpen = false;
  }

  async addToHome() {
    if (!this.contextMenuOpen) {
      return;
    }

    let menu = this.shadowRoot.querySelector(".menu");
    let activity = new WebActivity("add-to-home", { app: menu.app });
    await activity.start();

    this.closeContextMenu();
  }

  async uninstall() {
    if (!this.contextMenuOpen) {
      return;
    }

    let menu = this.shadowRoot.querySelector(".menu");
    await window.appsManager.uninstall(menu.app.manifestUrl);

    this.closeContextMenu();
  }

  updated() {
    document.l10n.translateFragment(this.shadowRoot);
    // 确保子元素在更新后保持正确的桌面模式样式
    this.updateChildren();
  }

  render() {
    // console.log(`AppsList: ${this.appsNodes.length} apps`);

    return html`<link rel="stylesheet" href="components/apps_list.css" />
      <div class="container">${this.appsNodes}</div>
      <sl-menu class="menu hidden">
        <sl-menu-item disabled></sl-menu-item>
        <sl-divider></sl-divider>
        <sl-menu-item @click="${this.addToHome}" id="add-to-home-option">
          <sl-icon slot="prefix" name="home"></sl-icon>
          <span data-l10n-id="apps-list-add-home"></span>
        </sl-menu-item>
        <sl-menu-item @click="${this.uninstall}" id="uninstall-option">
          <sl-icon slot="prefix" name="trash-2"></sl-icon>
          <span data-l10n-id="apps-list-uninstall"></span>
        </sl-menu-item>
      </sl-menu>`;
  }
}

customElements.define("apps-list", AppsList);
