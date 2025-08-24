// <input-method> web component

class InputMethod extends HTMLElement {
  constructor() {
    super();
    this.flag = true;
    this.loaded = false;
    // 1s timer used to delay deactivation. This avoids changing the state
    // needlessly when navigating from a field to another.
    this.timer = null;
  }

  connectedCallback() {
    this.innerHTML = `
    <link rel="stylesheet" href="components/input_method.css">
    <web-view
      remote="true"
      ignoreuserfocus="true"
      mozpasspointerevents="true"
      transparent="true">
    </web-view>
    <div class="padding"><sl-icon name="chevron-down"></div></div>
    `;
    this.webView = this.querySelector("web-view");
    this.webView.openWindowInfo = null;

    this.pid = this.webView.pid;
    this.webView.addEventListener(
      "processready",
      (event) => {
        this.pid = event.detail.processid;
      },
      { once: true }
    );
  }

  activate() {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }

    this.activated = true;
    this.webView.active = true;
    if (this.pid != -1) {
      processManager.setForeground(this.pid);
    }
  }

  deactivate() {
    this.sendMessage({ deactivate: this.flag });
    this.flag = !this.flag;
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.timer = window.setTimeout(() => {
      this.webView.active = false;
      this.activated = false;
      if (this.pid != -1) {
        processManager.setBackground(this.pid);
      }
      this.timer = null;
    }, 1000 /* 1s delay */);
  }

  sendMessage(data) {
    const hash = new URLSearchParams(data).toString();
    this.webView.src = this.webView.src.split("#")[0] + "#" + hash;
  }

  init() {
    if (!this.loaded) {
      let keyboardUrl = `http://keyboard.localhost:${config.port}/index.html`;
      this.webView.src = keyboardUrl;
      this.loaded = true;
    }
  }
}

customElements.define("input-method", InputMethod);
