// User Agent override store.
// Maps origin -> UA string
// Each record is { origin: <string>, ua: "b2g|android|desktop" }
// TODO: add support for custom UA strings.

class UAStore extends EventTarget {
  constructor() {
    super();
    this.current = null;
    this.entries = new Map(); // Maps origin -> record.
    this.ensureReady();
  }

  log(msg) {
    console.log(`UAStore: ${msg}`);
  }

  error(msg) {
    console.error(`UAStore: ${msg}`);
  }

  async ensureReady() {
    if (!this.current) {
      await contentManager.as_superuser();
      let container = await contentManager.ensureTopLevelContainer("system");
      try {
        this.current = await contentManager.jsonChildByName(
          container,
          "ua-store.json"
        );
        if (this.current) {
          let json = this.current.variant();
          json.forEach((override) => {
            this.entries.set(override.origin, override);
          });
        } else {
          // Create initial empty resource.
          this.current = await contentManager.create(
            container,
            "ua-store.json",
            new Blob(["[]"], { type: "application/json" })
          );
        }
      } catch (e) {
        this.error(JSON.stringify(e));
      }
    }
  }

  getUaFor(href) {
    let url = new URL(href);
    let origin = url.origin;

    return this.entries.get(origin)?.ua;
  }

  async setUaFor(href, ua) {
    await this.ensureReady();
    let url = new URL(href);
    let origin = url.origin;

    this.entries.set(origin, { origin, ua });
    // Build the json array from the map.
    let json = [];
    for (let override of this.entries.values()) {
      json.push(override);
    }
    // this.log(`Updating with ${JSON.stringify(json)}`);
    await this.current.update(
      new Blob([JSON.stringify(json)], { type: "application/json" })
    );
  }
}

window.uaStore = new UAStore();
