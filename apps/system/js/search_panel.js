// Manages the search panel.

export class SearchPanel {
  init(panel, searchBox, clearSearch, privateBrowsing, searchResults, defaultSearchResults) {
    this.panel = panel;
    this.searchBox = searchBox;
    this.searchBox.addEventListener("input", this);
    
    // 添加keypress事件处理，用于处理回车键
    this.searchBox.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        this.handleEnterKey();
      }
    });
    
    this.searchResults = searchResults;
    this.clearSearch = clearSearch;
    this.defaultSearchResults = defaultSearchResults;
    this.clearSearch.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.searchBox.value = "";
      this.clearAllResults();
    });
    this.privateBrowsing = privateBrowsing;
    this.privateBrowsing.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.privateBrowsing.classList.toggle("active");
    });

    // 监听桌面模式切换事件
    window.addEventListener('desktop-mode-changed', (event) => {
      this.handleDesktopModeChange(event.detail.isDesktop);
    });

    this.sources = [
      new MediaSource("media", searchResults),
      new PlacesSource("places", searchResults),
      new SkillsSource("skills", searchResults),
      new ContactsSource("contacts", searchResults),
      new AppsSource("apps", searchResults),
      new TopSitesSource("top-sites", searchResults),
      new SearchActivitySource("activities", searchResults)
    ];
  }

  handleDesktopModeChange(isDesktop) {
    // 如果搜索框当前有焦点，根据桌面模式状态处理虚拟键盘
    if (document.activeElement === this.searchBox) {
      if (isDesktop) {
        this.searchBox.blur();
        // 延迟重新聚焦，避免触发虚拟键盘
        setTimeout(() => {
          this.searchBox.focus();
        }, 100);
      } else {
        // 重新触发焦点以确保虚拟键盘显示
        this.searchBox.blur();
        setTimeout(() => {
          this.searchBox.focus();
        }, 100);
      }
    }
  }

  onOpen() {
    this.panel.classList.add("open");
    this.clearSearch.classList.remove("hidden");
    this.privateBrowsing.classList.remove("hidden");
    this.privateBrowsing.classList.remove("active");
    this.searchResults.classList.remove("hidden");
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
    this.panel.classList.remove("open");
    this.clearSearch.classList.add("hidden");
    this.privateBrowsing.classList.add("hidden");
    this.searchResults.classList.add("hidden");
    document
      .getElementById("theme-color")
      .setAttribute("content", "transparent");
  }

  handleEnterKey() {
    // 检查是否有默认搜索结果可以执行
    if (this.defaultSearchResults && typeof this.defaultSearchResults.onEnterKey === 'function') {
      if (this.defaultSearchResults.onEnterKey()) {
        return; // 如果默认搜索结果处理了回车事件，直接返回
      }
    }

    // 获取搜索框的内容
    let input = this.searchBox.value.trim();
    if (!input || input.length === 0) {
      return;
    }

    // 模糊搜索框
    this.searchBox.blur();
    
    // 关闭搜索面板
    this.onClose();
    
    // 检查是否可以访问OpenSearch类
    if (typeof OpenSearch === 'undefined' && !this.opensearchEngine) {
      console.warn("SearchPanel: OpenSearch class not available, using direct search");
      // 直接处理URL或进行简单搜索
      if (!this.maybeOpenURL(input)) {
        // 使用默认搜索引擎
        const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(input)}`;
        this.maybeOpenURL(searchUrl, { search: input });
      }
      return;
    }

    // 创建 OpenSearch 引擎实例（如果需要）
    if (!this.opensearchEngine) {
      this.opensearchEngine = new OpenSearch();
    }

    // 使用类似homescreen的逻辑处理URL
    if (!this.maybeOpenURL(input)) {
      // 不是URL，执行关键词搜索
      const searchUrl = this.opensearchEngine.getSearchUrlFor(input);
      this.maybeOpenURL(searchUrl, { search: input });
    }
  }

  maybeOpenURL(url, details = {}) {
    if (!url || url.length == 0) {
      return false;
    }

    // 设置私密浏览模式
    details.privatebrowsing = this.privateBrowsing.classList.contains("active");

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

    try {
      // 没有"."且不是URL，可能是关键词搜索
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

      // 使用window.wm.openFrame而不是window.open
      let encoded = encodeURIComponent(JSON.stringify(details));
      window.wm.openFrame(url, {
        activate: true,
        details: encoded
      });
    } catch (e) {
      console.log(`SearchPanel: maybeOpenUrl error ${e}`);
    }
    return true;
  }

  openURL(url, search) {
    return window.wm.openFrame(url, {activate: true, detail: search});;
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
      this.defaultSearchResults.classList.add("hidden");
      this.defaultSearchResults.clear();

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
    this.defaultSearchResults.classList.remove("hidden");
    this.defaultSearchResults.refresh();
  }
}
