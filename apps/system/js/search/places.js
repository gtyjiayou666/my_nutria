// Top places search module.

function isPrivateBrowsing() {
  let elem = document.getElementById("private-browsing");
  return elem.classList.contains("active");
}

// Helper to decide how to process an window.open url parameter.
// Returns true if window.open() was called, false otherwise.
function maybeOpenURL(url, details = {}) {
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
    let a = window.open(url, "_blank", `details=${encoded}`);
    if (a == null) {
      console.info("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@")
    }
    console.log(`maybeOpenURL called window.open(${url})`);
  } catch (e) {
    console.log(`maybeOpenUrl oops ${e}`);
  }
  return true;
}

class Places {
  // Returns a Promise that resolves to a result set.
  async search(query, count) {
    console.log(`Places query ${query}`);
    let results = [];
    await contentManager.searchPlaces(query, count, (result) => {
      // console.log(`Places result: ${JSON.stringify(result)}`);
      if (result) {
        results.push(result);
      }
      return true;
    });

    // Reverse result order to better fit the UI and display the first
    // results closer to the keyboard.
    return results.reverse();
  }
}

class PlacesSource extends SearchSource {
  constructor(sectionName) {
    super(sectionName, new Places());
  }

  domForResult(result) {
    return new PlacesItemSearch(result);
  }

  activate(result) {
    let url = result.variants.default.url;
    maybeOpenURL(url);
    contentManager.visitPlace(url, true);
  }
}

// Define a custom element for our content.
class PlacesItemSearch extends LitElement {
  // data is { meta, variants }
  constructor(data) {
    super();
    this.data = data;
    this.revokable = [];
  }

  static get properties() {
    return {
      data: { state: true },
    };
  }

  variant(name = "default") {
    let variant = this.data.variants[name];
    if (variant) {
      if (typeof variant === "string") {
        return variant;
      }
      // Variant should be a blob if not a string.
      let url = URL.createObjectURL(variant);
      this.revokable.push(url);
      return url;
    }
  }

  render() {
    let content = this.data.variants.default;
    let iconSrc = this.variant("icon") || content.icon;

    return html`
      <link rel="stylesheet" href="style/search/places.css">
      <div class="entry" title="${content.url}">
        <img src=${iconSrc}/>
        <div class="title">${content.title}</div>
      </div>`;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.revokable.forEach(URL.revokeObjectURL);
    this.revokable = [];
  }

  activate() {
    this.addEventListener(
      "click",
      () => {
        SearchSource.closeSearch();
        let url = this.data.variants.default.url;
        // 在 system.js 中 (派发事件)
        // window.dispatchEvent(new CustomEvent('maybeOpenURL'), {
        //   detail: {
        //     url: url
        //   }
        // });
        // maybeOpenURL(url);

        console.info("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        actionsDispatcher.dispatch("maybeOpenURL", url); // WindowManager 会处理
        console.info("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        contentManager.visitPlace(url, true);
      },
      { once: true }
    );
  }
}

customElements.define("places-item-search", PlacesItemSearch);
