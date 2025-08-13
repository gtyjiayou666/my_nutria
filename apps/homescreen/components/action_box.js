// <action-box> custom element, representing an item on the homescreen.

const kLongPressMinMs = 200;

class ActionBox extends HTMLElement {
  // 在 ActionBox 类中添加
  setGhostActive(active, available = true) {
    if (active) {
      this.classList.add(available ? "ghost-active" : "ghost-blocked");
    } else {
      this.classList.remove("ghost-active", "ghost-blocked");
    }
  }
  
  static get observedAttributes() {
    return ["position"];
  }

  constructor() {
    super();
    this.contextMenuActive = false; // 初始化上下文菜单状态
  }

  connectedCallback() {
    let shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <link rel="stylesheet" href="components/action_box.css">
      <slot></slot>
      <div class="ghost hidden"></div>
      <div class="menu hidden">
        <sl-icon name="trash-2" width="1.25em" height="1.25em"></sl-icon>
      </div>
      <div class="context-menu hidden">
        <div class="context-menu-item" data-action="open">
          <sl-icon name="external-link"></sl-icon>
          <span>打开应用</span>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="delete">
          <sl-icon name="trash-2"></sl-icon>
          <span>删除应用</span>
        </div>
      </div>
    `;

    this.ghost = shadow.querySelector(".ghost");
    this.menu = shadow.querySelector(".menu");
    this.contextMenu = shadow.querySelector(".context-menu");
    this.menu.onclick = this.menuClick.bind(this);

    // 为上下文菜单添加事件监听
    this.contextMenu.addEventListener("click", this.handleContextMenuClick.bind(this));

    shadow.addEventListener("pointerdown", this, true);
    shadow.addEventListener("click", this, true);
    shadow.addEventListener("contextmenu", this, true);
    this.cancelClick = false;

    this.attributeChangedCallback(
      "position",
      null,
      this.getAttribute("position") || "0,0"
    );

    // 监听桌面模式变化事件
    window.addEventListener('desktop-mode-changed', (event) => {
      console.log(`ActionBox: Desktop mode changed to ${event.detail.isDesktop}`);
      // 如果切换到移动模式，隐藏任何打开的上下文菜单
      if (!event.detail.isDesktop && this.contextMenuActive) {
        this.hideContextMenu();
      }
    });
  }

  menuClick() {
    this.dispatchEvent(
      new CustomEvent("delete-action", { bubbles: true, detail: this.actionId })
    );
  }

  // 检查是否为桌面模式
  isDesktopMode() {
    // 首先检查 wallpaperManager 是否存在且准备就绪
    if (window.wallpaperManager && window.wallpaperManager.isWallpaperManagerReady()) {
      return window.wallpaperManager.isDesktop;
    }
    
    // 如果 wallpaperManager 不可用，检查其他可能的状态指示器
    if (window.wallpaperManager) {
      return window.wallpaperManager.isDesktop;
    }
    
    // 最后的后备方案：检查屏幕尺寸来判断（桌面模式通常屏幕更大）
    return window.innerWidth > 768;
  }

  // 显示上下文菜单
  showContextMenu(event) {
    // 隐藏任何现有的上下文菜单
    this.hideAllContextMenus();
    
    // 显示当前的上下文菜单
    this.contextMenu.classList.remove("hidden");
    
    // 计算菜单位置
    let left = event.clientX;
    let top = event.clientY;
    
    // 设置临时位置以获取菜单尺寸
    this.contextMenu.style.position = 'fixed';
    this.contextMenu.style.left = `${left}px`;
    this.contextMenu.style.top = `${top}px`;
    this.contextMenu.style.zIndex = '9999';
    
    // 获取菜单尺寸
    const menuRect = this.contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 确保菜单不会超出视窗边界
    if (left + menuRect.width > viewportWidth) {
      left = viewportWidth - menuRect.width - 10;
    }
    if (top + menuRect.height > viewportHeight) {
      top = viewportHeight - menuRect.height - 10;
    }
    
    // 确保菜单不会超出左边和上边
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    
    // 应用最终位置
    this.contextMenu.style.left = `${left}px`;
    this.contextMenu.style.top = `${top}px`;
    
    // 添加全局点击监听器来隐藏菜单
    document.addEventListener('click', this.hideContextMenuHandler, true);
    document.addEventListener('contextmenu', this.hideContextMenuHandler, true);
    document.addEventListener('keydown', this.hideContextMenuOnEscape, true);
    
    // 标记菜单为活动状态
    this.contextMenuActive = true;
  }

  // 隐藏所有上下文菜单（包括其他 action-box 的菜单）
  hideAllContextMenus() {
    document.querySelectorAll('action-box').forEach(box => {
      const menu = box.shadowRoot?.querySelector('.context-menu');
      if (menu && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
      }
    });
  }

  // 隐藏上下文菜单
  hideContextMenu() {
    if (!this.contextMenuActive) return;
    
    this.contextMenu.classList.add("hidden");
    document.removeEventListener('click', this.hideContextMenuHandler, true);
    document.removeEventListener('contextmenu', this.hideContextMenuHandler, true);
    document.removeEventListener('keydown', this.hideContextMenuOnEscape, true);
    this.contextMenuActive = false;
  }

  // 隐藏上下文菜单的处理器
  hideContextMenuHandler = (event) => {
    if (!this.contextMenu.contains(event.target)) {
      this.hideContextMenu();
    }
  }

  // 按 ESC 键隐藏上下文菜单
  hideContextMenuOnEscape = (event) => {
    if (event.key === 'Escape') {
      this.hideContextMenu();
    }
  }

  // 处理上下文菜单项点击
  handleContextMenuClick(event) {
    event.stopPropagation();
    event.preventDefault();
    
    const menuItem = event.target.closest('.context-menu-item');
    if (!menuItem) return;
    
    const action = menuItem.dataset.action;
    
    switch (action) {
      case 'open':
        this.openApplication();
        break;
      case 'delete':
        this.menuClick(); // 复用现有的删除逻辑
        break;
      default:
        console.warn(`Unknown context menu action: ${action}`);
    }
    
    this.hideContextMenu();
  }

  // 打开应用
  openApplication() {
    // 模拟点击应用图标来打开应用
    const slotElement = this.shadowRoot.querySelector("slot").assignedNodes()[0];
    if (slotElement && slotElement.click) {
      slotElement.click();
    } else {
      // 如果没有直接的点击方法，分发点击事件
      this.dispatchEvent(new CustomEvent('click', { bubbles: true }));
    }
  }

  handleEvent(event) {
    if (event.type === "click") {
      if (this.cancelClick) {
        event.preventDefault();
      }
      this.cancelClick = false;
      return;
    } else if (event.type === "pointerdown") {
      // 只在非桌面模式下启用长按功能
      if (!this.isDesktopMode()) {
        this.shadowRoot.addEventListener("pointerup", this, { once: true });
        let startPos = { x: event.screenX, y: event.screenY };
        let capturedPointerId = event.pointerId;

        this.timer = window.setTimeout(() => {
          this.setPointerCapture(capturedPointerId);
          this.cancelClick = true;
          this.dispatchEvent(
            new CustomEvent("long-press", { bubbles: true, detail: startPos })
          );
        }, kLongPressMinMs);
      }
    } else if (event.type === "pointerup") {
      if (this.timer) {
        window.clearTimeout(this.timer);
      }
    } else if (event.type === "contextmenu") {
      event.preventDefault();
      // 检查是否为桌面模式
      if (this.isDesktopMode()) {
        console.log('Desktop mode detected, showing context menu');
        this.showContextMenu(event);
      } else {
        console.log('Mobile mode detected, context menu disabled');
      }
    } else {
      console.error(`<action-box> handled unexpected event: ${event.type}`);
    }
  }

  attributeChangedCallback(_name, _oldValue, newValue) {
    let [x, y] = newValue.split(",");
    this.x = x | 0;
    this.y = y | 0;
    this.style.left = `calc(${this.x} * var(--action-box-width))`;
    this.style.bottom = `calc(${this.y} * var(--action-box-height))`;
  }

  translateBy(deltaX, deltaY) {
    if (deltaX === 0 && deltaY === 0) {
      this.style.left = `calc(${this.x} * var(--action-box-width))`;
      this.style.bottom = `calc(${this.y} * var(--action-box-height))`;
    } else {
      this.style.left = `calc(${this.x} * var(--action-box-width) + ${deltaX}px)`;
      this.style.bottom = `calc(${this.y} * var(--action-box-height) - ${deltaY}px)`;
    }
  }

  animate(value) {
    try {
      let slot = this.shadowRoot.querySelector("slot").assignedNodes()[0];
      slot.animate(value);
    } catch (e) {
      console.error(`action_box::animate() error: ${e}`);
    }

    // Show or hide the context menu.
    if (value) {
      this.menu.classList.remove("hidden");
    } else {
      // Hide the menu after 2s
      window.setTimeout(() => {
        this.menu.classList.add("closing");
        this.menu.addEventListener(
          "transitionend",
          () => {
            this.menu.classList.remove("closing");
            this.menu.classList.add("hidden");
          },
          { once: true }
        );
      }, 2000);
    }
  }

  setGhostState(enabled) {
    if (enabled) {
      this.ghost.classList.remove("hidden");
    } else {
      this.ghost.classList.add("hidden");
    }
  }

  setGhostActive(enabled) {
    if (enabled) {
      this.ghost.classList.add("active");
    } else {
      this.ghost.classList.remove("active");
    }
  }
}

customElements.define("action-box", ActionBox);
