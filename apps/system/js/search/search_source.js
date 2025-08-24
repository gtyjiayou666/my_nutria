// Base class for search sources.
// Each search source is tied to a section of the results panel.

class SearchSource {
  constructor(sourceName, engine, searchResults) {
    this.name = sourceName;
    this.engine = engine;

    // Add the UI for this source:
    // <div id="contacts-results" class="no-blur"></div>
    // <h4 data-l10n-id="contacts-title"
    //     id="contacts-title"
    //    class="hidden no-blur"></h4>

    this.results = document.createElement("div");
    this.results.setAttribute("id", `${sourceName}-results`);
    this.results.classList.add("no-blur");

    this.title = document.createElement("h4");
    this.title.setAttribute("id", `${sourceName}-title`);
    this.title.setAttribute("data-l10n-id", `${sourceName}-title`);
    this.title.classList.add("no-blur");
    this.title.classList.add("hidden");

    searchResults.appendChild(this.results);
    searchResults.appendChild(this.title);
  }

  static closeSearch() {
    // 首先尝试主文档中的搜索面板
    const mainSearchPanel = document.getElementById('main-search-panel');
    if (mainSearchPanel && mainSearchPanel.classList.contains('open')) {
      const statusBar = document.querySelector("status-bar");
      if (statusBar) {
        statusBar.closeSearchPanel();
      }
      return;
    }
    
    // 备用方案：访问Shadow DOM中的搜索框
    let searchBox = document.querySelector("status-bar").shadowRoot.getElementById("search-box");
    if (searchBox) {
      searchBox.blur();
    }
  }

  get resultsNode() {
    return this.results;
  }

  get titleNode() {
    return this.title;
  }

  clearResults() {
    this.results.innerHTML = "";
    this.title.classList.add("hidden");
  }

  search(what, maxCount) {
    if (!this.preserveCase) {
      what = what.toLowerCase();
    }
    return this.engine.search(what, maxCount);
  }
}
