// The <action-activity> custom element.

class ActionActivity extends HTMLElement {
  constructor(data) {
    super();

    this.init(data);
  }

  // data = { icon, title, activity: { name, data } }
  init(data) {
    this.icon = URL.createObjectURL(data.icon);
    this.title = data.title;
    this.activity = data.activity;
  }

  connectedCallback() {
    let shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <link rel="stylesheet" href="components/action_activity.css">
      <div class="activity">
        <img src="${this.icon}" alt="${this.title}"></img>
        <span>${this.title}</span>
      </div>
      `;

    shadow.querySelector(".activity").onclick = (event) => {
      // 检查是否为桌面模式，如果是则不直接处理点击
      const actionBox = this.closest('action-box');
      if (actionBox && actionBox.isDesktopMode && actionBox.isDesktopMode()) {
        console.log('Desktop mode: action-activity delegating click to action-box');
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
      
      // 移动模式或没有action-box包装时，直接启动活动
      this.startActivity();
    };
  }
  
  startActivity() {
    let activity = new WebActivity(this.activity.name, this.activity.data);
    activity.start().then(
      (res) => {
        console.error(`ActionActivity Result returned by activity: ${res}`);
      },
      (err) => {
        console.error(`ActionActivity Error returned by activity: ${err}`);
      }
    );
  }

  disconnectedCallback() {
    URL.revokeObjectURL(this.icon);
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
      console.error(`ActionActivity::animate() error: ${e}`);
    }
  }
}

customElements.define("action-activity", ActionActivity);
