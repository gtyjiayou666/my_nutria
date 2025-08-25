// The <action-bookmark> custom element.

class ActionBookmark extends HTMLElement {
  constructor(data) {
    super();
    this.init(data);
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
      <link rel="stylesheet" href="components/action_bookmark.css">
      <img src="${this.icon}" alt="${data.title}"></img>
      <span>${data.title}</span>
      `;

    this.onclick = (event) => {
      // 检查是否为桌面模式，如果是则不直接处理点击
      // 让外层的action-box来处理双击逻辑
      const actionBox = this.closest('action-box');
      if (actionBox && actionBox.isDesktopMode && actionBox.isDesktopMode()) {
        console.log('Desktop mode: action-bookmark delegating click to action-box');
        // 在桌面模式下，让action-box处理双击逻辑
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
      
      // 移动模式或没有action-box包装时，直接打开应用
      console.log('Mobile mode or standalone: action-bookmark opening directly');
      this.openBookmark();
    };
  }
  
  openBookmark() {
    let data = this.data;
    let details = {
      title: data.title,
      icon: this.icon,
      backgroundColor: data.backgroundColor,
      display: data.display || "browser",
    };
    let encoded = encodeURIComponent(JSON.stringify(details));
    window.open(data.url, "_blank", `details=${encoded}`);
  }

  disconnectedCallback() {
    if (this.icon.startsWith("blob")) {
      URL.revokeObjectURL(this.icon);
    }
  }

  animate(value) {
    try {
      let animated = this.shadowRoot.querySelector("img");
      if (value) {
        animated.classList.add("animate");
      } else {
        animated.classList.remove("animate");
      }
    } catch (e) {
      console.error(`action_bookmark::animate() error: ${e}`);
    }
  }
}

customElements.define("action-bookmark", ActionBookmark);
