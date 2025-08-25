// <system-statusbar> custom element.

class SwipeDetector extends EventTarget {
  constructor(elem) {
    super();

    elem.addEventListener("pointerdown", this);
    elem.addEventListener("pointerup", this);

    this.startX = undefined;
    this.startY = undefined;
    this.startedAt = undefined;

    let box = elem.getBoundingClientRect();

    // Half the height of the box -> swipe detected in Y axis.
    this.yTolerance = Math.round(box.height / 2) || 0;

    // 0.5cm -> swipe detected in X axis.
    let cm = (box.width * window.devicePixelRatio) / (96.0 * 2.56);
    this.xTolerance = Math.round((box.width * 0.5) / cm) || 0;

    this.log(`xTolerance=${this.xTolerance} yTolerance=${this.yTolerance}`);
  }

  log(msg) {
    console.log(`SwipeDetector: ${msg}`);
  }

  handleEvent(event) {
    if (event.type === "pointerdown") {
      this.startedAt = Date.now();
      this.startX = event.clientX;
      this.startY = event.clientY;
    } else if (event.type === "pointerup") {
      let elapsed = Date.now() - this.startedAt;
      let dx = event.clientX - this.startX;
      let dy = event.clientY - this.startY;

      // this.log(`dx=${dx} dy=${dy} elapsed=${elapsed}`);

      if (elapsed > 500) {
        return;
      }

      const xTolerance = this.xTolerance;
      const yTolerance = this.yTolerance;

      if (dx < xTolerance && dx > -xTolerance && dy < -yTolerance) {
        // this.log("Swiped Up");
        this.dispatchEvent(new CustomEvent("swipe-up"));
      }
      if (dx < xTolerance && dx > -xTolerance && dy > yTolerance) {
        // this.log("Swiped Down");
        this.dispatchEvent(new CustomEvent("swipe-down"));
      }
      if (dy < yTolerance && dy > -yTolerance && dx < -xTolerance) {
        // this.log("Swiped Left");
        this.dispatchEvent(new CustomEvent("swipe-left"));
      }
      if (dy < yTolerance && dy > -yTolerance && dx > xTolerance) {
        // this.log("Swiped Right");
        this.dispatchEvent(new CustomEvent("swipe-right"));
      }
    }
  }
}









const kBindingsModifier = "Control";
class KeyBindings {
  constructor() {
    this.isModifierDown = false;
    window.addEventListener("keydown", this, true);
    window.addEventListener("keyup", this, true);
  }

  handleEvent(event) {
    if (event.key == kBindingsModifier) {
      this.isModifierDown = event.type === "keydown";
    }

    // [Ctrl]+[l] opens the search box.
    if (this.isModifierDown && event.type === "keydown" && event.key === "l") {
      openSearchBox();
    }
  }
}








import { ensurePanelManager } from '../js/bootstrap.js';


class StatusBar extends HTMLElement {
  constructor() {
    super();

    this.shadow = this.attachShadow({ mode: "open" });

    this.carouselIcon =
      embedder.sessionType === "mobile" ? "layout-grid" : "columns";

    this.shadow.innerHTML = `
    <link rel="stylesheet" href="components/status_bar.css">
      <div class="container homescreen session-${embedder.sessionType}">
        <div class="left">
          <sl-icon class="static battery-icon homescreen-icon" name="battery-charging"></sl-icon>
          <img class="favicon" />
          <span class="left-text">Current page title that could be way too long to fit so we need to clip it some way.</span>
          <svg class="quicklaunch homescreen-icon desktop-mode" style="display: none; width: 2.25rem; height: 2.25rem; cursor: pointer; fill: currentColor;" alt="Apps" viewBox="0 0 24 24">
            <rect x="3" y="3" width="8" height="8" rx="1"/>
            <rect x="13" y="3" width="8" height="8" rx="1"/>
            <rect x="3" y="13" width="8" height="8" rx="1"/>
            <rect x="13" y="13" width="8" height="8" rx="1"/>
          </svg>
    <section id="search-panel">
      <div class="input no-blur">
        <input data-l10n-id="search-box-placeholder" id="search-box" />
        <sl-icon
          id="private-browsing"
          name="venetian-mask"
          class="hidden"
        ></sl-icon>
        <sl-icon id="qr-code" name="qr-code"></sl-icon>
        <sl-icon id="clear-search" name="x-circle" class="hidden"></sl-icon>
      </div>
      <div id="search-results" class="hidden">
        <default-results
          id="default-search-results"
          class="no-blur hidden"
        ></default-results>
      </div>
    </section>
        </div>
        <div class="center">
          <sl-icon name="circle-ellipsis" class="quicklaunch homescreen-icon mobile-mode"></sl-icon>
        </div>
        <div class="right">
          <sl-icon name="chevron-left" class="go-back content-icon"></sl-icon>
          <div class="frame-list homescreen-icon content-icon"></div>
          <sl-icon name="${this.carouselIcon}" class="homescreen-icon"></sl-icon>
          <sl-icon name="home" class="content-icon"></sl-icon>
          <sl-badge pill variant="neutral">
             <sl-icon name="more-vertical" class="homescreen-icon content-icon"></sl-icon>
          </sl-badge>
        </div>
      </div>
    </div>`;

    // Start with the homescreen section active
    this.isHomescreen = true;

    // Object used to memoize access to dom elements.
    this.elems = {};

    this.isCarouselOpen = false;

    // Initialize the clock and update it when needed.
    this.updateClock();
    this.clockTimer = new MinuteTimer();
    this.clockTimer.addEventListener("tick", () => {
      this.updateClock();
    });

    if (!navigator.getBattery) {
      console.error("navigator.getBattery is not implemented!");
      return;
    }

    window.batteryHelper.addListener(
      "statusbar",
      this.getElem(".battery-icon")
    );

    // Attach event listeners to icons.
    let homeElem = this.getElem(`sl-icon[name="home"]`);
    hapticFeedback.register(homeElem);

    homeElem.oncontextmenu = this.homeContextMenu = () => {
      this.triggerCarousel();
    };

    homeElem.onclick = this.homeClick = () => {
      if (this.isCarouselOpen) {
        actionsDispatcher.dispatch("close-carousel");
      }
      actionsDispatcher.dispatch("go-home");
    };

    let gridElem = this.getElem(`sl-icon[name="${this.carouselIcon}"]`);
    hapticFeedback.register(gridElem);
    gridElem.onclick = () => {
      actionsDispatcher.dispatch("open-carousel");
    };

    let goBackElem = this.getElem(`.go-back`);
    hapticFeedback.register(goBackElem);
    goBackElem.onclick = () => {
      this.state.canGoBack && actionsDispatcher.dispatch("go-back");
    };

    let moreElem = this.getElem(`sl-badge`);
    hapticFeedback.register(moreElem);
    moreElem.addEventListener("click", () => {
      actionsDispatcher.dispatch("open-quick-settings");
    });

    let infoElem = this.getElem(`.favicon`);
    hapticFeedback.register(infoElem);
    infoElem.onclick = () => {
      let siteInfo = document.body.querySelector("site-info");
      siteInfo.setState(this.state);
      siteInfo.addEventListener(
        "close",
        () => {
          this.state.bringAttention = false;
          this.updateState("", this.state);
        },
        { once: true }
      );
      siteInfo.open();
    };

    let quickLaunchElem = this.getElem(`.quicklaunch.mobile-mode`);
    hapticFeedback.register(quickLaunchElem);
    quickLaunchElem.onpointerdown = async () => {
      if (this.isCarouselOpen) {
        actionsDispatcher.dispatch("close-carousel");
      }
      document.getElementById("apps-list").toggle();
    };

    // 为桌面模式的 quicklaunch 图标也添加事件监听器
    let quickLaunchDesktopElem = this.getElem(`svg.quicklaunch.desktop-mode`);
    hapticFeedback.register(quickLaunchDesktopElem);
    quickLaunchDesktopElem.onpointerdown = async () => {
      if (this.isCarouselOpen) {
        actionsDispatcher.dispatch("close-carousel");
      }
      document.getElementById("apps-list").toggle();
    };

    let leftText = this.getElem(`.left-text`);
    leftText.onclick = () => {
      if (!this.state.isHomescreen) {
        actionsDispatcher.dispatch("open-url-editor", this.state.url);
      }
    };

    this.setupSwipeDetector();

    actionsDispatcher.addListener(
      "update-page-state",
      this.updateState.bind(this)
    );

    actionsDispatcher.addListener(
      "open-carousel",
      this.openCarousel.bind(this)
    );

    actionsDispatcher.addListener(
      "close-carousel",
      this.closeCarousel.bind(this)
    );

    actionsDispatcher.addListener(
      "notifications-count",
      this.updateNotifications.bind(this)
    );

    actionsDispatcher.addListener("lockscreen-locked", () => {
      this.clockTimer.suspend();
    });

    actionsDispatcher.addListener("lockscreen-unlocked", () => {
      if (this.state.isHomescreen) {
        this.updateClock();
        this.clockTimer.resume();
      }
    });

    actionsDispatcher.addListener("top-status-bar-changed", () => {
      // forces an update.
      this.updateState("", this.state);
    });

    if (embedder.sessionType !== "mobile") {
      actionsDispatcher.addListener(
        "update-frame-list",
        this.updateFrameList.bind(this)
      );
      this.getElem(`.frame-list`).onclick = (event) => {
        let localName = event.target.localName;
        let target = event.target;
        switch (localName) {
          case "img":
            target = target.parentElement;
          case "div":
            let id = target.getAttribute("id").split("-")[1];
            if (this.isCarouselOpen) {
              actionsDispatcher.dispatch("close-carousel");
            }
            window.wm.switchToFrame(id);
            break;
          case "sl-icon":
            // Toggle the muted state of the frame.
            let frameId = target.parentElement.getAttribute("id").split("-")[1];
            window.wm.toggleMutedState(frameId);
            break;
          default:
            console.log(`Unexpected frame-list target: ${localName}`);
        }
      };

      // Add right-click context menu for frame list items
      this.getElem(`.frame-list`).oncontextmenu = (event) => {
        // Only show context menu in desktop mode
        const isDesktop = this.classList.contains('desktop-mode');
        if (!isDesktop) {
          return; // Allow default context menu behavior in mobile mode
        }
        
        event.preventDefault();
        let localName = event.target.localName;
        let target = event.target;
        
        // Find the frame div element
        if (localName === "img") {
          target = target.parentElement;
        }
        
        if (localName === "div" || (localName === "img" && target.localName === "div")) {
          let frameId = target.getAttribute("id").split("-")[1];
          this.showTaskbarContextMenu(event, frameId);
        }
      };
    }







    this.keyBindings = new KeyBindings();
    this.searchPanel = this.shadow.getElementById("search-panel");
    this.clearSearch = this.shadow.getElementById("clear-search");
    this.privateBrowsing = this.shadow.getElementById("private-browsing");
    this.searchResults = this.shadow.getElementById("search-results");
    this.defaultSearchResults = this.shadow.getElementById("default-search-results");
    if (!this.searchPanel) {
      console.error("search-panel not found in main document.");
      return;
    }
    this.searchBox = this.shadow.getElementById('search-box');
    this.panelManager = null;

    console.log("StatusBar: searchBox found:", this.searchBox);
    console.log("StatusBar: searchBox style:", this.searchBox ? window.getComputedStyle(this.searchBox) : "not found");


    this.searchBox.addEventListener("blur", () => {
      // console.log("Search Box: blur");
      // 注释掉自动关闭，因为我们现在使用主文档中的搜索面板
      // this.closeSearchPanel();
      // this.panelManager.clearAllResults();
    });

    this.searchBox.addEventListener("focus", () => {
      console.log("Search Box: focus event triggered");
      this.openSearchPanel();

      // 检查当前是否为桌面模式，如果是则防止虚拟键盘弹出
      if (window.embedder && !window.embedder.useVirtualKeyboard) {
        // 桌面模式下，确保不会触发虚拟键盘
        this.searchBox.setAttribute('inputmode', 'none');
      } else {
        // 移动模式下，允许虚拟键盘
        this.searchBox.removeAttribute('inputmode');
      }
    });

    // 添加点击事件作为备用方案
    this.searchBox.addEventListener("click", () => {
      console.log("Search Box: click event triggered");
      this.searchBox.focus(); // 确保获得焦点，这会触发focus事件
    });

    // 为整个搜索输入容器添加点击事件
    const searchInput = this.shadow.querySelector('#search-panel .input');
    if (searchInput) {
      searchInput.addEventListener("click", (e) => {
        console.log("Search Input Container: click event triggered");
        if (e.target !== this.searchBox) {
          this.searchBox.focus();
        }
      });
    }

    this.searchBox.addEventListener("input", (e) => {
      // 当底部栏搜索框内容改变时，同步到主搜索面板
      const mainSearchPanel = document.getElementById('main-search-panel');
      if (mainSearchPanel) {
        const mainSearchBox = mainSearchPanel.querySelector('#main-search-box');
        if (mainSearchBox && mainSearchBox.value !== e.target.value) {
          mainSearchBox.value = e.target.value;
        }
      }
      
      // 触发搜索功能 - 调用SearchPanel的handleEvent方法
      if (this.panelManager && typeof this.panelManager.handleEvent === 'function') {
        this.panelManager.handleEvent();
      }
    });

    this.searchBox.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.searchBox.blur();
      }

      if (event.key === "Tab") {
        this.defaultSearchResults.onTabKey(event);
        this.event.preventDefault();
      }
    });

    this.opensearchEngine = null;
    this.searchBox.addEventListener("keypress", (event) => {
      this.opensearchEngine = this.opensearchEngine || new OpenSearch();
      console.log(`SearchBox: keypress ${event.key}`);
      if (event.key !== "Enter") {
        return;
      }

      if (this.defaultSearchResults.onEnterKey()) {
        return;
      }

      let input = this.searchBox.value.trim();
      this.searchBox.blur();
      if (!this.maybeOpenURL(input)) {
        // Keyword search, redirect to the current search engine.
        this.maybeOpenURL(this.opensearchEngine.getSearchUrlFor(input), { search: input });
      }
    });





    // Initialize desktop mode state after all event listeners are set
    this.initializeDesktopMode();

  }


  closeSearchPanel() {
    console.log("closeSearchPanel called");
    
    // 关闭主文档中的搜索面板
    const mainSearchPanel = document.getElementById('main-search-panel');
    if (mainSearchPanel) {
      mainSearchPanel.classList.remove('open');
      
      // 移除事件监听器
      if (mainSearchPanel._closeHandler) {
        mainSearchPanel.removeEventListener('click', mainSearchPanel._closeHandler);
        document.removeEventListener('keydown', mainSearchPanel._closeHandler);
      }
    }
    
    // 移除body的class
    document.body.classList.remove('search-panel-open');
    
    // 清空搜索框
    this.searchBox.value = "";
    if (mainSearchPanel) {
      const mainSearchBox = mainSearchPanel.querySelector('#main-search-box');
      if (mainSearchBox) {
        mainSearchBox.value = "";
      }
    }
    
    if (this.panelManager) {
      this.panelManager.onClose();
    }
    
    // 移除搜索面板打开状态类名
    this.classList.remove("search-panel-open");
    console.log("Removed search-panel-open class");
  }
  async openSearchPanel() {
    console.log("openSearchPanel called");
    
    // 检查是否已经存在主文档中的搜索面板
    let mainSearchPanel = document.getElementById('main-search-panel');
    if (!mainSearchPanel) {
      // 在主文档中创建搜索面板
      mainSearchPanel = document.createElement('div');
      mainSearchPanel.id = 'main-search-panel';
      mainSearchPanel.innerHTML = `
        <div class="search-panel-overlay">
          <div class="search-input-container">
            <div class="search-input">
              <input type="text" id="main-search-box" placeholder="搜索..." />
              <sl-icon id="main-private-browsing" name="venetian-mask" class="private-btn hidden"></sl-icon>
              <sl-icon id="main-clear-search" name="x-circle" class="clear-btn"></sl-icon>
              <sl-icon id="main-close-search" name="x" class="close-btn"></sl-icon>
            </div>
          </div>
          <div id="main-search-results" class="search-results">
            <default-results id="main-default-search-results" class="hidden"></default-results>
          </div>
        </div>
      `;
      document.body.appendChild(mainSearchPanel);
      
      // 添加样式
      if (!document.getElementById('main-search-panel-styles')) {
        const style = document.createElement('style');
        style.id = 'main-search-panel-styles';
        style.textContent = `
          #main-search-panel {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            bottom: 4em; /* 使用bottom属性确保不覆盖底部栏 */
            background-color: rgba(0, 0, 0, 0.8);
            z-index: 1000; /* 确保比statusbar的z-index低 */
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            padding-bottom: 1em;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
          }
          
          #main-search-panel.open {
            opacity: 1;
            pointer-events: all;
          }
          
          /* 确保底部状态栏在搜索面板打开时仍然可见，不被覆盖 */
          system-statusbar {
            z-index: 9999 !important;
            position: relative !important;
          }
          
          body.search-panel-open system-statusbar {
            z-index: 9999 !important;
            position: relative !important;
          }
          
          #main-search-panel .search-input-container {
            width: 90%;
            max-width: 600px;
            margin: 0 0 1em 2em; /* 恢复左下角位置 */
            /* 完全隐藏主搜索输入框，让用户只看到底部栏的输入 */
            display: none;
          }
          
          #main-search-panel .search-input {
            display: flex;
            align-items: center;
            background-color: white;
            border-radius: 8px;
            padding: 0.5em;
            gap: 0.25em;
          }
          
          #main-search-panel .search-input input {
            flex: 1;
            border: none;
            outline: none;
            font-size: 1rem;
            background: none;
            color: black;
          }
          
          #main-search-panel .search-input sl-icon {
            font-size: 1.5rem;
            cursor: pointer;
            color: #666;
          }
          
          #main-search-panel .search-input .close-btn {
            color: #999;
          }
          
          #main-search-panel .search-input .clear-btn {
            color: #666;
          }
          
          #main-search-panel .search-input .private-btn {
            color: #8000d7;
          }
          
          #main-search-panel .search-input .clear-btn.hidden,
          #main-search-panel .search-input .private-btn.hidden {
            display: none;
          }
          
          #main-search-panel .search-results {
            width: 90%;
            max-width: 600px;
            margin: 0 0 1em 2em; /* 与搜索输入框对齐，位于左下角 */
            background-color: rgba(0, 0, 0, 0.95);
            border-radius: 12px;
            padding: 1em;
            max-height: 50vh;
            overflow-y: auto;
            color: white;
            flex: 1;
          }
          
          #main-search-panel .hidden {
            display: none;
          }
        `;
        document.head.appendChild(style);
      }
    }
    
    // 显示搜索面板
    mainSearchPanel.classList.add('open');
    document.body.classList.add('search-panel-open');
    
    // 聚焦搜索框 - 这里我们聚焦底部栏的搜索框而不是主面板的
    this.searchBox.focus();
    
    const searchBox = mainSearchPanel.querySelector('#main-search-box');
    if (searchBox) {
      // 复制原搜索框的值到主面板搜索框
      searchBox.value = this.searchBox.value;
      
      // 添加输入事件监听器
      if (!searchBox._inputHandler) {
        searchBox._inputHandler = (e) => {
          // 同步到原搜索框，以便搜索管理器能够正常工作
          this.searchBox.value = e.target.value;
          
          // 也要更新主搜索面板中的搜索框显示（如果它不是当前焦点）
          const mainSearchBox = mainSearchPanel.querySelector('#main-search-box');
          if (mainSearchBox && mainSearchBox !== e.target) {
            mainSearchBox.value = e.target.value;
          }
          
          // 触发原搜索框的输入事件
          this.searchBox.dispatchEvent(new Event('input', { bubbles: true }));
          
          // 控制清除按钮的显示
          const clearBtn = mainSearchPanel.querySelector('#main-clear-search');
          if (clearBtn) {
            if (e.target.value.length > 0) {
              clearBtn.classList.remove('hidden');
            } else {
              clearBtn.classList.add('hidden');
            }
          }
        };
        searchBox.addEventListener('input', searchBox._inputHandler);
      }
      
      // 添加清除按钮事件监听器
      const clearBtn = mainSearchPanel.querySelector('#main-clear-search');
      if (clearBtn && !clearBtn._clickHandler) {
        clearBtn._clickHandler = () => {
          searchBox.value = '';
          this.searchBox.value = '';
          clearBtn.classList.add('hidden');
          // 触发输入事件以清空搜索结果
          this.searchBox.dispatchEvent(new Event('input', { bubbles: true }));
        };
        clearBtn.addEventListener('click', clearBtn._clickHandler);
      }
      
      // 添加关闭按钮事件监听器
      const closeBtn = mainSearchPanel.querySelector('#main-close-search');
      if (closeBtn && !closeBtn._clickHandler) {
        closeBtn._clickHandler = () => {
          this.closeSearchPanel();
        };
        closeBtn.addEventListener('click', closeBtn._clickHandler);
      }
    }
    
    // 初始化搜索功能
    if (!this.panelManager) {
      this.panelManager = await ensurePanelManager();
    }
    
    // 使用主文档中的元素初始化
    const mainClearSearch = mainSearchPanel.querySelector('#main-clear-search');
    const mainPrivateBrowsing = mainSearchPanel.querySelector('#main-private-browsing');
    const mainSearchResults = mainSearchPanel.querySelector('#main-search-results');
    const mainDefaultSearchResults = mainSearchPanel.querySelector('#main-default-search-results');
    
    // 重新初始化搜索面板管理器，使用底部栏的搜索框作为主要输入
    this.panelManager.init(mainSearchPanel, this.searchBox, mainClearSearch, mainPrivateBrowsing, mainSearchResults, mainDefaultSearchResults);
    this.panelManager.onOpen();
    
    // 添加搜索面板打开状态类名
    this.classList.add("search-panel-open");
    console.log("Added search-panel-open class, classes:", this.className);
    
    // 添加关闭事件监听
    const closePanel = (e) => {
      if (e.type === 'click') {
        // 检查点击是否在搜索输入区域或搜索结果区域内
        const searchInputContainer = mainSearchPanel.querySelector('.search-input-container');
        const searchResults = mainSearchPanel.querySelector('.search-results');
        
        // 如果点击的是搜索输入区域或搜索结果区域内的元素，不关闭面板
        if (searchInputContainer && (searchInputContainer.contains(e.target) || searchInputContainer === e.target)) {
          return;
        }
        if (searchResults && (searchResults.contains(e.target) || searchResults === e.target)) {
          return;
        }
        
        // 其他区域的点击都关闭搜索面板
        this.closeSearchPanel();
      } else if (e.type === 'keydown' && e.key === 'Escape') {
        this.closeSearchPanel();
      }
    };
    
    mainSearchPanel.addEventListener('click', closePanel);
    document.addEventListener('keydown', closePanel);
    
    // 存储事件监听器引用以便后续移除
    mainSearchPanel._closeHandler = closePanel;
  }
  openSearchBox() {
    if (!this.searchPanel.classList.contains("open")) {
      this.searchBox.focus();
    }
  }


  isPrivateBrowsing() {
    let elem = this.shadow.getElementById("private-browsing");
    return elem.classList.contains("active");
  }

  maybeOpenURL(url, details = {}) {
    console.log(`maybeOpenURL ${url}`);
    if (!url || url.length == 0) {
      return false;
    }

    details.privatebrowsing = isPrivateBrowsing();

    let isUrl = false;
    try {
      let a = new URL(url);
      isUrl = true;
    } catch (e) { }

    if (url.startsWith("about:")) {
      let act = new WebActivity("open-about", { url });
      act.start();
      return true;
    }

    const isFileUrl = url.startsWith("file://");
    console.log(`maybeOpenURL isUrl=${isUrl} isFileUrl=${isFileUrl}`);

    try {
      // No "." in the url that is not a file:// or ipfs:// one, return false since this
      // is likely a keyword search.
      if (!url.includes(".") && !isUrl) {
        return false;
      }

      if (
        !isFileUrl &&
        !url.startsWith("http") &&
        !url.startsWith("ipfs://") &&
        !url.startsWith("ipns://") &&
        !url.startsWith("tile://")
      ) {
        url = `https://${url}`;
      }

      let encoded = encodeURIComponent(JSON.stringify(details));
      window.open(url, "_blank", `details=${encoded}`);
      console.log(`maybeOpenURL called window.open(${url})`);
    } catch (e) {
      console.log(`maybeOpenUrl oops ${e}`);
    }
    return true;
  }





  setupSwipeDetector() {
    const swipeDetector = new SwipeDetector(this);
    swipeDetector.addEventListener("swipe-down", () => {
      if (this.isCarouselOpen) {
        actionsDispatcher.dispatch("close-carousel");
        actionsDispatcher.dispatch("go-home");
      }
    });
    swipeDetector.addEventListener("swipe-up", () => {
      if (this.isCarouselOpen) {
        actionsDispatcher.dispatch("close-carousel");
        actionsDispatcher.dispatch("go-home");
      } else {
        this.triggerCarousel();
      }
    });
    swipeDetector.addEventListener("swipe-left", () => {
      this.state.canGoBack && actionsDispatcher.dispatch("go-back");
    });
    swipeDetector.addEventListener("swipe-right", () => {
      this.state.canGoForward && actionsDispatcher.dispatch("go-forward");
    });
  }

  triggerCarousel() {
    if (this.isCarouselOpen) {
      return;
    }

    // Update state as if we were on the homescreen to ensure
    // we will display the correct icons.
    let state = Object.create(this.state);
    state.isHomescreen = true;
    this.updateState("", state);
    actionsDispatcher.dispatch("open-carousel");
  }

  updateClock(force = false) {
    let now = this.displayLocalTime();
    if (force || now !== this.lastClock) {
      this.getElem(".left-text").textContent = now;

      // 同时更新桌面模式的时钟
      const desktopClock = this.shadow.querySelector('.desktop-clock');
      if (desktopClock) {
        desktopClock.textContent = now;
      }

      this.lastClock = now;
    }
  }

  updateFrameList(_name, list) {
    if (embedder.sessionType === "mobile") {
      return;
    }
    let frames = this.getElem(`.frame-list`);
    let content = "";
    list.forEach((frame) => {
      let icon = frame.icon || window.config.brandLogo;
      let iconClass = frame.id == this.currentActive ? "active" : "";
      if (frame.isPlayingAudio) {
        iconClass += " audio";
      }
      content += `<div class="${iconClass}" id="shortcut-${frame.id}">
                    <img class="favicon" src="${icon}" title="${frame.title}" alt="${frame.title}"/>`;
      if (frame.isPlayingAudio) {
        content += `<sl-icon name="${frame.audioMuted ? "volume-x" : "volume-1"
          }" class="content-icon homescreen-icon"></sl-icon>`;
      }
      content += "</div>";
    });
    frames.innerHTML = content;
  }

  openCarousel() {
    this.isCarouselOpen = true;
    this.getElem(".container").classList.add("carousel");
    this.getElem(`sl-icon[name="home"]`).classList.add("carousel");
    this.getElem(`sl-icon[name="${this.carouselIcon}"]`).classList.add(
      "hidden"
    );
    this.updateBackgroundColor("transparent", true);
    document.getElementById("status-top").classList.add("carousel");
  }

  closeCarousel() {
    this.isCarouselOpen = false;
    this.getElem(".container").classList.remove("carousel");
    this.getElem(`sl-icon[name="home"]`).classList.remove("carousel");
    this.getElem(`sl-icon[name="${this.carouselIcon}"]`).classList.remove(
      "hidden"
    );
    document.getElementById("status-top").classList.remove("carousel");
  }

  updateNotifications(_name, count) {
    let moreElem = this.getElem(`sl-badge`);
    if (count !== 0) {
      moreElem.variant = "primary";
    } else {
      moreElem.variant = "neutral";
    }
  }

  getElem(selector) {
    if (!this.elems[selector]) {
      this.elems[selector] = this.shadow.querySelector(selector);
    }
    return this.elems[selector];
  }

  // Returns the local time properly formatted.
  displayLocalTime() {
    // Manually apply offset to UTC since we have no guarantee that
    // anything else but `UTC` will work in DateTimeFormat.
    let now = Date.now() - new Date().getTimezoneOffset() * 60 * 1000;

    if (!this.timeFormat) {
      let options = {
        hour: "numeric",
        minute: "numeric",
        timeZone: "UTC",
        hour12: false,
      };
      this.timeFormat = new Intl.DateTimeFormat("default", options);
    }
    return this.timeFormat.format(now);
  }

  updateDisplayState(state) {
    let display = state.display || "browser";
    let statustop = document.getElementById("status-top");
    let screenElem = document.getElementById("screen");
    if (display === "fullscreen") {
      this.classList.add("fullscreen");
      statustop.classList.add("fullscreen");
      screenElem.classList.add("fullscreen");
    } else {
      this.classList.remove("fullscreen");
      statustop.classList.remove("fullscreen");
      screenElem.classList.remove("fullscreen");
    }
  }

  updateHomescreenState(state) {
    this.updateDisplayState(state);
    let left = this.getElem(".left-text");
    left.classList.remove("insecure");
    this.updateClock(true);
  }

  updateContentState(state) {
    this.updateDisplayState(state);
    let left = this.getElem(".left-text");
    left.textContent = state.title || state.url;

    let isSecure = state.secure == "secure";
    if (state.url) {
      let url = new URL(state.url);
      isSecure =
        isSecure ||
        url.protocol == "about:" ||
        url.protocol == "ipfs:" ||
        url.protocol == "ipns:" ||
        url.protocol == "tile:" ||
        url.protocol == "chrome:" ||
        url.protocol == "moz-extension:" ||
        url.hostname.endsWith(".localhost");
    }

    // Reader mode is secure
    if (state.readerMode?.isReaderMode) {
      isSecure = true;
    }

    if (isSecure) {
      left.classList.remove("insecure");
    } else {
      left.classList.add("insecure");
    }

    let goBack = this.getElem(".go-back");
    if (state.canGoBack) {
      goBack.classList.remove("disabled");
    } else {
      goBack.classList.add("disabled");
    }

    // If the app was opened from the lock screen, prevent access
    // to the quick settings.
    // Hitting "Home" closes the app instead of going to the home screen.
    let moreElem = this.getElem(`sl-badge`);
    let homeElem = this.getElem(`sl-icon[name="home"]`);
    if (state.fromLockscreen && homeElem.oncontextmenu) {
      moreElem.classList.add("hidden");

      homeElem.oncontextmenu = null;
      homeElem.onclick = async () => {
        if (state.whenClosed) {
          await state.whenClosed();
        }
        window.wm.closeFrame();
      };

      // Observes the next frame being closed: it's either the FTU or
      // an app launched from the lockscreen.
      // In both cases we can now reset the UI to show the "more" icon.
      window.wm.addEventListener(
        "frameclosed",
        async () => {
          homeElem.onclick = this.homeClick;
          homeElem.oncontextmenu = this.homeContextMenu;
          moreElem.classList.remove("hidden");
        },
        { once: true }
      );
    } else if (!state.fromLockscreen) {
      moreElem.classList.remove("hidden");
    }
  }

  setTopStatusBarBackground(color) {
    // Set the background of the "top" status bar needed when there is
    // a camera sensor.
    if (window.config.topStatusBar) {
      document.getElementById("status-top").style.backgroundColor = color;
    }
  }

  updateBackgroundColor(backgroundColor, enterCarousel = false) {
    // Manage the backgroundColor, if any
    this.classList.remove("transparent");

    if (this.state.privatebrowsing) {
      this.style.backgroundColor = null;
      if (enterCarousel) {
        this.classList.remove("privatebrowsing");
        this.setTopStatusBarBackground(null);
        this.classList.add("transparent");
      } else {
        this.classList.add("privatebrowsing");
      }
      return;
    } else {
      this.classList.remove("privatebrowsing");
    }

    if (backgroundColor) {
      let color = backgroundColor;
      if (color == "transparent") {
        // When transparent, keep the default backgroundColor defined by
        // the theme.
        this.style.backgroundColor = null;
        this.setTopStatusBarBackground(null);
        this.classList.add("transparent");
        return;
      }
      this.style.backgroundColor = color;
      this.setTopStatusBarBackground(color);

      // Calculate the luminance of the background color to decide if we
      // should use a dark or light text color.
      let rgba = color
        .match(/rgba?\((.*)\)/)[1]
        .split(",")
        .map(Number);

      // rgba detected transparent.
      if (rgba[3] == 0) {
        this.style.backgroundColor = null;
        this.classList.add("transparent");
        return;
      }

      // See https://searchfox.org/mozilla-central/rev/8be17dcf81d9bd894c398b53282d43d782815967/widget/nsXPLookAndFeel.cpp#1286
      let normalized = rgba.map((value) => {
        value = value / 255.0;
        if (value <= 0.03928) {
          return value / 12.92;
        }
        return Math.pow((value + 0.055) / 1.055, 2.4);
      });
      const luminance =
        0.2126 * normalized[0] +
        0.7152 * normalized[1] +
        0.0722 * normalized[2];
      const high_luminance = luminance > 0.179129;
      console.log(
        `Found background for ${color}: luminance=${luminance} red=${rgba[0]} green=${rgba[1]} blue=${rgba[2]} high_luminance=${high_luminance}`
      );

      // Set a class accordingly so that the theme can choose which colors to use.
      if (high_luminance) {
        this.classList.add("high-luminance");
        this.state.highLuminance = true;
      } else {
        this.classList.remove("high-luminance");
        this.state.highLuminance = false;
      }
    } else {
      // No background color available:
      // Apply the same treatement as transparent background colors.
      this.style.backgroundColor = null;
      this.style.backgroundColor = null;
      this.classList.add("transparent");
    }
  }

  initializeDesktopMode() {
    // 设置默认状态，与 wallpaperManager 保持一致（默认桌面模式）
    const mobileQuicklaunch = this.getElem('.quicklaunch.mobile-mode');
    const desktopQuicklaunch = this.getElem('svg.quicklaunch.desktop-mode');
    const screenElement = document.getElementById('screen');

    // 检查 wallpaperManager 是否已加载并获取当前状态
    let currentIsDesktop = window.wallpaperManager ? window.wallpaperManager.isDesktop : true; // 默认桌面模式

    // 立即设置正确的状态
    this.updateQuicklaunchPosition(currentIsDesktop);

    // 监听桌面模式状态变化
    if (window.wallpaperManager) {
      // 监听桌面模式切换事件
      window.addEventListener('desktop-mode-changed', (event) => {
        console.log(`StatusBar: Desktop mode changed to ${event.detail.isDesktop}`);
        this.updateQuicklaunchPosition(event.detail.isDesktop);
      });
    } else {
      // 如果 wallpaperManager 还未加载，等待其加载完成
      window.addEventListener('wallpaper-manager-ready', () => {
        console.log(`StatusBar: WallpaperManager ready, setting desktop mode to ${window.wallpaperManager.isDesktop}`);
        this.updateQuicklaunchPosition(window.wallpaperManager.isDesktop);
        window.addEventListener('desktop-mode-changed', (event) => {
          console.log(`StatusBar: Desktop mode changed to ${event.detail.isDesktop}`);
          this.updateQuicklaunchPosition(event.detail.isDesktop);
        });
      });
    }
  }

  updateQuicklaunchPosition(isDesktop) {
    const mobileQuicklaunch = this.getElem('.quicklaunch.mobile-mode');
    const desktopQuicklaunch = this.getElem('svg.quicklaunch.desktop-mode');
    const screenElement = document.getElementById('screen');

    console.log(`StatusBar: updateQuicklaunchPosition to ${isDesktop ? 'desktop' : 'mobile'} mode`);
    console.log(`StatusBar: Current classes before update:`, this.className);

    if (isDesktop) {
      // 桌面模式：重新组织状态栏布局
      this.enableDesktopTaskbar();
      if (mobileQuicklaunch) {
        mobileQuicklaunch.style.display = 'none';
      }
      if (desktopQuicklaunch) {
        desktopQuicklaunch.style.display = 'initial';
      }
      // 添加桌面模式样式类
      this.classList.add('desktop-mode');
      if (screenElement) {
        screenElement.classList.add('desktop-mode');
      }
      
      // 显示搜索面板
      if (this.searchPanel) {
        this.searchPanel.style.display = 'flex';
        this.searchPanel.style.visibility = 'visible';
        this.searchPanel.style.opacity = '1';
      }
      
      console.log(`StatusBar: Added desktop-mode class, current classes:`, this.className);
    } else {
      // 移动模式：恢复原始布局
      this.disableDesktopTaskbar();
      if (mobileQuicklaunch) {
        mobileQuicklaunch.style.display = 'initial';
      }
      if (desktopQuicklaunch) {
        desktopQuicklaunch.style.display = 'none';
      }
      // 移除桌面模式样式类
      this.classList.remove('desktop-mode');
      if (screenElement) {
        screenElement.classList.remove('desktop-mode');
      }

      console.log(`StatusBar: Removed desktop-mode class, current classes:`, this.className);
      console.log(`StatusBar: Search panel element:`, this.searchPanel);

      // 隐藏搜索面板
      if (this.searchPanel) {
        this.searchPanel.style.display = 'none';
        this.searchPanel.style.visibility = 'hidden';
        this.searchPanel.style.opacity = '0';
      }

      // 确保移动模式下status bar是可见的
      this.style.display = '';
      this.classList.remove('fullscreen');
      
      // 在移动模式下，如果搜索面板是打开的，则关闭它
      const mainSearchPanel = document.getElementById('main-search-panel');
      if (mainSearchPanel && mainSearchPanel.classList.contains('open')) {
        this.closeSearchPanel();
      }
      
      console.log(`StatusBar: Mobile mode restored, display:`, this.style.display);
    }

    console.log(`StatusBar: Current classes after update:`, this.className);
    console.log(`StatusBar: Status bar visibility:`, window.getComputedStyle(this).display);
  }

  enableDesktopTaskbar() {
    // 重新组织容器为 Windows 任务栏风格
    const container = this.getElem('.container');
    container.classList.add('desktop-taskbar');

    // 重新组织现有元素
    this.reorganizeForDesktop();

    // 添加系统托盘区域
    this.createSystemTray();
  }

  disableDesktopTaskbar() {
    // 恢复移动模式布局
    const container = this.getElem('.container');
    container.classList.remove('desktop-taskbar');

    // 移除桌面模式特有的元素
    this.removeDesktopElements();

    // 恢复原始布局
    this.restoreOriginalLayout();
  }

  createSystemTray() {
    // 创建系统托盘区域（如果不存在）
    let systemTray = this.shadow.querySelector('.system-tray');
    if (!systemTray) {
      systemTray = document.createElement('div');
      systemTray.className = 'system-tray desktop-only';

      // 移动时间和电池图标到系统托盘
      const batteryIcon = this.getElem('.battery-icon');
      const clockElement = document.createElement('div');
      clockElement.className = 'desktop-clock';
      clockElement.textContent = this.displayLocalTime();

      systemTray.appendChild(batteryIcon.cloneNode(true));
      systemTray.appendChild(clockElement);

      // 添加到容器末尾
      const container = this.getElem('.container');
      container.appendChild(systemTray);

      // 隐藏原来的电池图标
      batteryIcon.style.display = 'none';
    }
  }

  reorganizeForDesktop() {
    // 重新组织中间区域为任务栏
    const frameList = this.getElem('.frame-list');
    const left = this.getElem('.left');
    const center = this.getElem('.center');
    const right = this.getElem('.right');

    // 隐藏移动模式的元素
    if (center) center.style.display = 'none';

    // 重新组织左侧区域
    if (left) {
      left.classList.add('desktop-left');
      // 隐藏移动模式特有的元素
      const leftText = this.getElem('.left-text');
      const favicon = this.getElem('.favicon');
      if (leftText) leftText.style.display = 'none';
      if (favicon) favicon.style.display = 'none';
    }

    // 重新组织右侧区域为工具栏
    if (right) {
      right.classList.add('desktop-right');
    }

    // 将任务栏移到中心位置
    if (frameList) {
      frameList.classList.add('desktop-taskbar-items');
    }
  }

  removeDesktopElements() {
    // 移除桌面模式特有的元素
    const systemTray = this.shadow.querySelector('.system-tray');
    if (systemTray) systemTray.remove();
  }

  restoreOriginalLayout() {
    // 恢复原始布局
    const left = this.getElem('.left');
    const center = this.getElem('.center');
    const right = this.getElem('.right');
    const frameList = this.getElem('.frame-list');
    const batteryIcon = this.getElem('.battery-icon');
    const leftText = this.getElem('.left-text');
    const favicon = this.getElem('.favicon');

    console.log('StatusBar: Restoring original mobile layout');

    // 恢复显示移动模式元素
    if (center) {
      center.style.display = '';
      console.log('StatusBar: Center restored');
    }
    if (leftText) {
      leftText.style.display = '';
      console.log('StatusBar: Left text restored');
    }
    if (favicon) {
      favicon.style.display = '';
      console.log('StatusBar: Favicon restored');
    }
    if (batteryIcon) {
      batteryIcon.style.display = '';
      console.log('StatusBar: Battery icon restored');
    }

    // 移除桌面模式类
    if (left) left.classList.remove('desktop-left');
    if (right) right.classList.remove('desktop-right');
    if (frameList) frameList.classList.remove('desktop-taskbar-items');

    // 确保状态栏容器本身是可见的
    const container = this.getElem('.container');
    if (container) {
      container.style.display = '';
      container.classList.remove('desktop-taskbar');
      console.log('StatusBar: Container restored');
    }

    console.log('StatusBar: Original layout restoration complete');
  }

  updateState(_name, state) {
    if (this.isCarouselOpen) {
      return;
    }

    // We switched from homescreen <-> content, reorder the sections
    // so they get events properly.
    if (this.isHomescreen !== state.isHomescreen) {
      this.isHomescreen = state.isHomescreen;
      if (state.isHomescreen) {
        this.clockTimer.resume();
        this.updateClock();
      } else {
        this.clockTimer.suspend();
      }

      this.getElem(".container").classList.toggle("homescreen");
      this.getElem(".container").classList.toggle("content");
    }

    let favicon = this.getElem(`.favicon`);
    favicon.src = state.isHomescreen
      ? ""
      : state.icon || window.config.brandLogo;

    if (state.privatebrowsing) {
      favicon.src = "resources/privatebrowsing.svg";
    }

    // if (state.bringAttention) {
    //   this.getElem(`sl-icon[name="info"]`).classList.add("attention");
    // } else {
    //   this.getElem(`sl-icon[name="info"]`).classList.remove("attention");
    // }

    this.state = state;

    // Update the frame list state.
    if (embedder.sessionType !== "mobile") {
      if (this.currentActive !== state.id) {
        let selector = this.currentActive
          ? `#shortcut-${this.currentActive}`
          : `.frame-list div.active`;
        let currentActive = this.shadowRoot.querySelector(selector);
        if (currentActive) {
          currentActive.classList.remove("active");
        }
      }
      let frameListElem = this.shadowRoot.querySelector(
        `#shortcut-${state.id} img`
      );
      if (frameListElem) {
        frameListElem.src = state.icon || window.config.brandLogo;
        frameListElem.setAttribute("alt", state.title);
        frameListElem.setAttribute("title", state.title);
        frameListElem.parentElement.classList.add("active");
      }
      this.currentActive = state.id;
    }

    // Toggle visibility accordingly.
    if (state.isHomescreen) {
      this.updateHomescreenState(state);
    } else {
      this.updateContentState(state);
    }

    this.updateBackgroundColor(state.backgroundColor);
  }

  showTaskbarContextMenu(event, frameId) {
    // Check if we're in desktop mode - in mobile mode, we shouldn't show taskbar context menu
    const isDesktop = this.classList.contains('desktop-mode');
    if (!isDesktop) {
      return; // Don't show context menu in mobile mode
    }

    // Remove any existing taskbar context menu
    const existingMenu = document.querySelector('.taskbar-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    // Create context menu element
    const menu = document.createElement('div');
    menu.className = 'taskbar-context-menu';
    menu.style.position = 'fixed';
    menu.style.zIndex = '10000';
    menu.style.background = 'rgba(255, 255, 255, 0.98)';
    menu.style.border = '1px solid rgba(0, 0, 0, 0.12)';
    menu.style.borderRadius = '8px';
    menu.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)';
    menu.style.padding = '6px 0';
    menu.style.minWidth = '140px';
    menu.style.backdropFilter = 'blur(12px)';
    menu.style.transition = 'all 0.15s ease-out';
    menu.style.transform = 'scale(0.95)';
    menu.style.opacity = '0';
    
    // 添加一个小指示器来显示菜单是活跃的
    const indicator = document.createElement('div');
    indicator.style.position = 'absolute';
    indicator.style.top = '-2px';
    indicator.style.left = '50%';
    indicator.style.transform = 'translateX(-50%)';
    indicator.style.width = '20px';
    indicator.style.height = '3px';
    indicator.style.background = 'linear-gradient(90deg, #3b82f6, #06b6d4)';
    indicator.style.borderRadius = '2px';
    indicator.style.boxShadow = '0 0 6px rgba(59, 130, 246, 0.4)';
    menu.appendChild(indicator);

    // Get frame information
    const frameInfo = window.wm.frames[frameId];
    const isActive = this.currentActive === frameId;

    // Create menu items
    const menuItems = [
      {
        label: isActive ? '已激活' : '切换到此窗口',
        action: () => {
          if (!isActive) {
            window.wm.switchToFrame(frameId);
          }
        },
        disabled: isActive
      },
      {
        label: '关闭窗口',
        action: () => {
          window.wm.closeFrame(frameId);
        },
        style: 'color: #dc2626;'
      }
    ];

    // Add menu items to the menu
    menuItems.forEach((item, index) => {
      const menuItem = document.createElement('div');
      menuItem.style.padding = '12px 16px';
      menuItem.style.cursor = item.disabled ? 'default' : 'pointer';
      menuItem.style.fontSize = '14px';
      menuItem.style.fontWeight = '500';
      menuItem.style.color = item.disabled ? '#9ca3af' : '#1f2937';
      menuItem.style.transition = 'all 0.15s ease';
      menuItem.style.position = 'relative';
      menuItem.style.userSelect = 'none';
      
      if (item.style) {
        menuItem.style.cssText += item.style;
      }
      
      // 添加图标
      const icon = document.createElement('span');
      icon.style.marginRight = '8px';
      icon.style.fontSize = '16px';
      if (item.label.includes('切换') || item.label.includes('已激活')) {
        icon.textContent = '🔄';
      } else if (item.label.includes('关闭')) {
        icon.textContent = '❌';
      }
      
      menuItem.appendChild(icon);
      const textSpan = document.createElement('span');
      textSpan.textContent = item.label;
      menuItem.appendChild(textSpan);
      
      if (!item.disabled) {
        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.backgroundColor = '#f0f9ff';
          menuItem.style.borderRadius = '4px';
          menuItem.style.transform = 'translateX(2px)';
        });
        
        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.backgroundColor = '';
          menuItem.style.borderRadius = '';
          menuItem.style.transform = '';
        });
        
        menuItem.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // 添加点击效果
          menuItem.style.transform = 'scale(0.98)';
          setTimeout(() => {
            item.action();
            menu.style.transform = 'scale(0.95)';
            menu.style.opacity = '0';
            setTimeout(() => {
              if (document.body.contains(menu)) {
                menu.remove();
              }
              document.removeEventListener('click', hideMenu);
              document.removeEventListener('contextmenu', hideMenu);
            }, 150);
          }, 100);
        });
      } else {
        // 禁用状态的样式
        menuItem.style.opacity = '0.6';
      }
      
      menu.appendChild(menuItem);
    });

    // Position the menu
    let left = event.clientX;
    let top = event.clientY;

    // Add menu to document to get dimensions
    document.body.appendChild(menu);
    const menuRect = menu.getBoundingClientRect();

    // Adjust position to keep menu on screen
    if (left + menuRect.width > window.innerWidth) {
      left = window.innerWidth - menuRect.width - 10;
    }
    if (top + menuRect.height > window.innerHeight) {
      top = event.clientY - menuRect.height;
    }
    
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    
    // 启动进入动画
    requestAnimationFrame(() => {
      menu.style.transform = 'scale(1)';
      menu.style.opacity = '1';
    });

    // 优化菜单隐藏逻辑 - 让菜单更稳定，更容易操作
    let menuHideTimeout = null;
    let isMouseOverMenu = false;
    
    // 鼠标进入菜单时清除隐藏计时器
    menu.addEventListener('mouseenter', () => {
      isMouseOverMenu = true;
      if (menuHideTimeout) {
        clearTimeout(menuHideTimeout);
        menuHideTimeout = null;
      }
    });
    
    // 鼠标离开菜单时设置延迟隐藏
    menu.addEventListener('mouseleave', () => {
      isMouseOverMenu = false;
      menuHideTimeout = setTimeout(() => {
        if (!isMouseOverMenu) {
          menu.remove();
          document.removeEventListener('click', hideMenu);
          document.removeEventListener('contextmenu', hideMenu);
        }
      }, 1500); // 1.5秒后隐藏
    });

    // 点击菜单外部时隐藏菜单
    const hideMenu = (e) => {
      // 如果点击的是菜单内部，不隐藏
      if (menu.contains(e.target)) {
        return;
      }
      
      // 如果鼠标在菜单上，延迟隐藏
      if (isMouseOverMenu) {
        return;
      }
      
      menu.remove();
      document.removeEventListener('click', hideMenu);
      document.removeEventListener('contextmenu', hideMenu);
      if (menuHideTimeout) {
        clearTimeout(menuHideTimeout);
      }
    };
    
    // 延迟添加点击监听器，避免立即触发
    setTimeout(() => {
      document.addEventListener('click', hideMenu);
      document.addEventListener('contextmenu', hideMenu); // 右键也会隐藏菜单
    }, 200);
    
    // 添加自动隐藏计时器（保险措施）
    setTimeout(() => {
      if (document.body.contains(menu) && !isMouseOverMenu) {
        menu.remove();
        document.removeEventListener('click', hideMenu);
        document.removeEventListener('contextmenu', hideMenu);
      }
    }, 10000); // 10秒后强制隐藏
  }
}

customElements.define("status-bar", StatusBar);
