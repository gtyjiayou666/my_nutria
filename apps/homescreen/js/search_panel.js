// Manages the search panel.

export class SearchPanel {
  constructor() {
    this._lastKnownDesktopMode = null;
    this._desktopModeCache = null;
    this._cacheTimestamp = 0;
  }

  init() {
    this.panel = document.getElementById("search-panel");
    this.searchBox = document.getElementById("search-box");
    this.searchBox.addEventListener("input", this);

    this.clearSearch = document.getElementById("clear-search");
    this.clearSearch.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.searchBox.value = "";
      this.clearAllResults();
    });

    this.privateBrowsing = document.getElementById("private-browsing");
    this.privateBrowsing.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.privateBrowsing.classList.toggle("active");
    });

    // 监听桌面模式切换事件
    window.addEventListener('desktop-mode-changed', (event) => {
      console.log(`SearchPanel: Received desktop-mode-changed event, isDesktop=${event.detail.isDesktop}`);
      this.handleDesktopModeChange(event.detail.isDesktop);
    });

    // 立即设置搜索框的可见性，获取当前桌面模式状态
    const currentDesktopMode = this.getCurrentDesktopMode();
    console.log(`SearchPanel: Initial desktop mode detection: ${currentDesktopMode}`);
    this.updateSearchPanelVisibility(currentDesktopMode);
    
    // 同时再设置一个延迟的检查，以防状态在初始化后发生变化
    setTimeout(() => {
      const laterDesktopMode = this.getCurrentDesktopMode();
      if (laterDesktopMode !== currentDesktopMode) {
        console.log(`SearchPanel: Desktop mode changed during initialization: ${currentDesktopMode} -> ${laterDesktopMode}`);
        this.updateSearchPanelVisibility(laterDesktopMode);
      }
    }, 200);

    this.sources = [
      new MediaSource("media"),
      new PlacesSource("places"),
      new SkillsSource("skills"),
      new ContactsSource("contacts"),
      new AppsSource("apps"),
      new TopSitesSource("top-sites"),
      new SearchActivitySource("activities"),
      // new FendConverterSource("fend-converter"),
      // new OpenSearchSource("suggestions"),
    ];
  }

  // 获取当前桌面模式状态
  getCurrentDesktopMode() {
    // 使用缓存，避免频繁检查（缓存100ms）
    const now = Date.now();
    if (this._desktopModeCache !== null && (now - this._cacheTimestamp) < 100) {
      return this._desktopModeCache;
    }
    
    let detectionSource = "unknown";
    let result = false;
    
    // 优先检查 embedder.sessionType，这是最可靠的
    if (window.embedder && window.embedder.sessionType) {
      const sessionType = window.embedder.sessionType;
      result = (sessionType === "desktop" || sessionType === "session");
      detectionSource = "embedder.sessionType";
      console.log(`SearchPanel: Using embedder.sessionType = ${sessionType}, isDesktop = ${result}`);
    } else if (window.wallpaperManager && typeof window.wallpaperManager.isDesktop !== 'undefined') {
      // 检查 wallpaperManager
      result = window.wallpaperManager.isDesktop;
      detectionSource = "wallpaperManager";
      console.log(`SearchPanel: Using wallpaperManager.isDesktop = ${result}`);
    } else {
      // 检查 QuickSettings 的状态
      const quickSettings = document.querySelector('quick-settings');
      if (quickSettings && typeof quickSettings.isDesktop !== 'undefined') {
        result = quickSettings.isDesktop;
        detectionSource = "QuickSettings";
        console.log(`SearchPanel: Using QuickSettings.isDesktop = ${result}`);
      } else {
        // 最后才检查 actions-wall 组件（这个似乎有问题）
        const actionsWall = document.querySelector('actions-wall');
        // 优先检查 embedder.sessionType，这是最可靠的
        if (window.embedder && window.embedder.sessionType) {
          const sessionType = window.embedder.sessionType;
          result = (sessionType === "desktop" || sessionType === "session");
          detectionSource = "embedder.sessionType";
          console.log(`SearchPanel: Using embedder.sessionType = ${sessionType}, isDesktop = ${result}`);
        } else if (window.wallpaperManager && typeof window.wallpaperManager.isDesktop !== 'undefined') {
          result = window.wallpaperManager.isDesktop;
          detectionSource = "wallpaperManager";
          console.log(`SearchPanel: Using wallpaperManager.isDesktop = ${result}`);
        } else if (actionsWall && typeof actionsWall.isDesktopMode === 'function') {
          result = actionsWall.isDesktopMode();
          detectionSource = "actionsWall";
          console.log(`SearchPanel: Using actionsWall.isDesktopMode() = ${result} (WARNING: This might be unreliable)`);
        } else {
          // 最终默认为移动模式（非桌面模式），这样搜索框会显示
          result = false;
          detectionSource = "fallback";
          console.log("SearchPanel: Using final fallback = false (mobile mode)");
        }
      }
    }
    
    // 更新缓存
    this._desktopModeCache = result;
    this._cacheTimestamp = now;
    this._lastKnownDesktopMode = result;
    
    console.log(`SearchPanel: Desktop mode detection result: ${result} (source: ${detectionSource})`);
    return result;
  }

  handleDesktopModeChange(isDesktop) {
    // 清除缓存，确保使用最新状态
    this._desktopModeCache = null;
    this._lastKnownDesktopMode = isDesktop;
    
    console.log(`SearchPanel: handleDesktopModeChange called with isDesktop=${isDesktop}`);
    
    // 根据桌面模式设置搜索框的可见性
    this.updateSearchPanelVisibility(isDesktop);
    
    // 如果搜索框当前有焦点，根据桌面模式状态处理虚拟键盘
    if (document.activeElement === this.searchBox) {
      if (isDesktop) {
        // 桌面模式：强制关闭虚拟键盘并失去焦点（因为搜索框已隐藏）
        this.searchBox.blur();
      } else {
        // 移动模式：确保虚拟键盘能够正常显示，并重新打开搜索面板
        // 重新触发焦点以确保虚拟键盘显示
        this.searchBox.blur();
        setTimeout(() => {
          this.searchBox.focus();
        }, 100);
      }
    } else if (!isDesktop && this.panel.classList.contains("open")) {
      // 如果切换到移动模式且搜索面板曾经是打开的，重新设置为可见
      this.updateSearchPanelVisibility(false);
    }
  }

  updateSearchPanelVisibility(isDesktop) {
    if (typeof isDesktop === 'undefined') {
      // 如果没有传入参数，尝试从全局状态获取
      isDesktop = this.getCurrentDesktopMode();
    }
    
    console.log(`SearchPanel: updateSearchPanelVisibility called with isDesktop=${isDesktop}`);
    console.log(`SearchPanel: Current panel display style: ${this.panel.style.display}`);
    console.log(`SearchPanel: Current panel visibility: ${this.panel.style.visibility}`);
    
    if (isDesktop) {
      // 桌面模式：隐藏搜索框
      console.log("SearchPanel: Hiding search panel (desktop mode)");
      this.panel.style.setProperty('display', 'none', 'important');
      this.panel.style.visibility = "hidden";
      // 禁用过渡动画以立即隐藏
      this.panel.style.transition = "none";
      // 强制重新计算样式
      this.panel.offsetHeight;
      // 恢复过渡动画
      this.panel.style.transition = "";
    } else {
      // 移动模式：显示搜索框
      console.log("SearchPanel: Showing search panel (mobile mode)");
      this.panel.style.setProperty('display', 'flex', 'important');
      this.panel.style.setProperty('flex-direction', 'column', 'important');
      this.panel.style.visibility = "visible";
      // 禁用过渡动画以立即显示
      this.panel.style.transition = "none";
      // 强制重新计算样式
      this.panel.offsetHeight;
      // 恢复过渡动画
      this.panel.style.transition = "";
    }
    
    console.log(`SearchPanel: After update - panel display: ${this.panel.style.display}, visibility: ${this.panel.style.visibility}`);
  }

  onOpen() {
    console.log("SearchPanel: onOpen() called");
    
    this.panel.classList.add("open");
    this.clearSearch.classList.remove("hidden");
    this.privateBrowsing.classList.remove("hidden");
    this.privateBrowsing.classList.remove("active");
    document.getElementById("search-results").classList.remove("hidden");
    this.panel.addEventListener(
      "transitionend",
      () => {
        document
          .getElementById("theme-color")
          .setAttribute("content", "rgba(0, 0, 0, 0.5)");
      },
      { once: true }
    );

    this.getTopFrecencyResults();
  }

  onClose() {
    console.log("SearchPanel: onClose() called");
    this.panel.classList.remove("open");
    this.clearSearch.classList.add("hidden");
    this.privateBrowsing.classList.add("hidden");
    document.getElementById("search-results").classList.add("hidden");
    document
      .getElementById("theme-color")
      .setAttribute("content", "transparent");
    
    // 使用延迟来确保状态检查的准确性
    setTimeout(() => {
      // 在移动模式下，确保搜索框保持可见
      const currentDesktopMode = this.getCurrentDesktopMode();
      console.log(`SearchPanel: onClose() - Desktop mode: ${currentDesktopMode}`);
      
      if (!currentDesktopMode) {
        // 移动模式：确保搜索框保持显示
        console.log("SearchPanel: onClose() - Keeping search panel visible in mobile mode");
        this.panel.style.setProperty('display', 'flex', 'important');
        this.panel.style.setProperty('flex-direction', 'column', 'important');
        this.panel.style.visibility = "visible";
      } else {
        console.log("SearchPanel: onClose() - Hiding search panel in desktop mode");
        this.panel.style.setProperty('display', 'none', 'important');
        this.panel.style.visibility = "hidden";
      }
    }, 10);
  }

  openURL(url, search) {
    return maybeOpenURL(url, { search });
  }

  clearAllResults() {
    this.sources.forEach((source) => {
      source.clearResults();
    });
  }

  // Add nodes to parent, but will try to replace
  // existing children if any instead of starting
  // from scratch if some are already in the tree.
  mergeDom(parent, nodes) {
    let childCount = parent.children.length;
    let children = parent.children;

    if (childCount <= nodes.length) {
      // Less children in parent than new nodes: replace all
      // existing parent children and add remaining nodes.
      for (let i = 0; i < children.length; i++) {
        children[i].replaceWith(nodes[i]);
      }

      for (let i = children.length; i < nodes.length; i++) {
        parent.appendChild(nodes[i]);
      }
    } else {
      // More children in parent than new nodes: replace all
      // nodes, remove the remaining children from the parent.
      for (let i = 0; i < nodes.length; i++) {
        children[i].replaceWith(nodes[i]);
      }

      let toRemove = childCount - nodes.length;
      for (let i = 0; i < toRemove; i++) {
        children[nodes.length].remove();
      }
    }
  }

  handleEvent() {
    let what = this.searchBox.value.trim();

    let inputChanged = this.previousInput !== what;
    this.previousInput = what;

    if (what.length == 0) {
      inputChanged && this.getTopFrecencyResults();
      return;
    }

    if (what.length < 2) {
      // Clear top frecency results if any.
      let defaultResults = document.getElementById("default-search-results");
      defaultResults.classList.add("hidden");
      defaultResults.clear();

      // Clear search results in case we had some from
      // a longer search term.
      this.clearAllResults();

      // TODO: just trigger a search
      return;
    }

    this.sources.forEach(async (source) => {
      let results = await source.search(what, 7);
      if (results.length === 0) {
        source.clearResults();
        return;
      }
      source.titleNode.classList.remove("hidden");

      let nodes = [];
      results.forEach((result) => {
        let node = source.domForResult(result);
        node.addEventListener(
          "click",
          () => {
            this.clearAllResults();
            // Make sure we will dismiss the virtual keyboard.
            SearchSource.closeSearch();
            source.activate(result);
          },
          { once: true }
        );
        nodes.push(node);
      });
      this.mergeDom(source.resultsNode, nodes);
    });
  }

  async getTopFrecencyResults() {
    // console.log(`getTopFrecencyResults`);
    let defaultResults = document.getElementById("default-search-results");
    defaultResults.classList.remove("hidden");
    defaultResults.refresh();
  }
}
