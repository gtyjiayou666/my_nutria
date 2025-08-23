// Manages the search panel.

export class SearchPanel {
  init(panel, searchBox, clearSearch, privateBrowsing, searchResults, defaultSearchResults) {
    console.info("SearchPanel   is     loading")
    this.panel = panel;
    this.searchBox = searchBox;
    this.searchBox.addEventListener("input", this);
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
      new SearchActivitySource("activities", searchResults),
      // new FendConverterSource("fend-converter"),
      // new OpenSearchSource("suggestions"),
    ];
  }

  handleDesktopModeChange(isDesktop) {
    // 如果搜索框当前有焦点，根据桌面模式状态处理虚拟键盘
    if (document.activeElement === this.searchBox) {
      if (isDesktop) {
        // 桌面模式：强制关闭虚拟键盘（如果有的话）
        this.searchBox.blur();
        // 延迟重新聚焦，避免触发虚拟键盘
        setTimeout(() => {
          this.searchBox.focus();
        }, 100);
      } else {
        // 移动模式：确保虚拟键盘能够正常显示
        // 重新触发焦点以确保虚拟键盘显示
        this.searchBox.blur();
        setTimeout(() => {
          this.searchBox.focus();
        }, 100);
      }
    }
  }

  onOpen() {
    console.info("search  on  open !!!!!!!!!!!!!!!!!!!!!")
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
    console.info("search  on  onClose !!!!!!!!!!!!!!!!!!!!!")
    this.panel.classList.remove("open");
    this.clearSearch.classList.add("hidden");
    this.privateBrowsing.classList.add("hidden");
    this.searchResults.classList.add("hidden");
    document
      .getElementById("theme-color")
      .setAttribute("content", "transparent");
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
    // console.log(`getTopFrecencyResults`);
    this.defaultSearchResults.classList.remove("hidden");
    this.defaultSearchResults.refresh();
  }
}
