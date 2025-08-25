// <action-box> custom element, representing an item on the homescreen.

const kLongPressDelay = 200;

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
    this.isDesktop = true; // 本地桌面模式状态，默认为桌面模式
    
    // 双击相关属性
    this.lastClickTime = 0;
    this.doubleClickDelay = 300; // 300ms内的第二次点击视为双击
    this.clickTimeout = null;
    this.isDragging = false; // 跟踪拖拽状态
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
      this.isDesktop = event.detail.isDesktop; // 更新本地状态
      // 如果切换到移动模式，隐藏任何打开的上下文菜单
      if (!event.detail.isDesktop && this.contextMenuActive) {
        this.hideContextMenu();
      }
    });

    // 初始化桌面模式状态
    this.initializeDesktopState();
  }

  menuClick() {
    this.dispatchEvent(
      new CustomEvent("delete-action", { bubbles: true, detail: this.actionId })
    );
  }

  // 初始化桌面模式状态，与 QuickSettings 保持同步
  initializeDesktopState() {
    // 首先检查 QuickSettings 的状态
    const quickSettings = document.querySelector('quick-settings');
    if (quickSettings && typeof quickSettings.isDesktop !== 'undefined') {
      this.isDesktop = quickSettings.isDesktop;
      console.log(`ActionBox: Initialized from QuickSettings, isDesktop = ${this.isDesktop}`);
      return;
    }
    
    // 如果 QuickSettings 不可用，检查 wallpaperManager
    if (window.wallpaperManager && typeof window.wallpaperManager.isDesktop !== 'undefined') {
      this.isDesktop = window.wallpaperManager.isDesktop;
      console.log(`ActionBox: Initialized from wallpaperManager, isDesktop = ${this.isDesktop}`);
      return;
    }
    
    // 使用轮询检查状态直到找到有效值
    const checkState = () => {
      const quickSettings = document.querySelector('quick-settings');
      if (quickSettings && typeof quickSettings.isDesktop !== 'undefined') {
        this.isDesktop = quickSettings.isDesktop;
        console.log(`ActionBox: Found QuickSettings state via polling, isDesktop = ${this.isDesktop}`);
        return;
      }
      
      if (window.wallpaperManager && typeof window.wallpaperManager.isDesktop !== 'undefined') {
        this.isDesktop = window.wallpaperManager.isDesktop;
        console.log(`ActionBox: Found wallpaperManager state via polling, isDesktop = ${this.isDesktop}`);
        return;
      }
      
      // 继续轮询
      setTimeout(checkState, 100);
    };
    
    // 开始轮询
    setTimeout(checkState, 100);
    
    // 如果都不可用，等待相关事件
    window.addEventListener('wallpaper-manager-ready', () => {
      if (window.wallpaperManager) {
        this.isDesktop = window.wallpaperManager.isDesktop;
        console.log(`ActionBox: Initialized after wallpaper-manager-ready, isDesktop = ${this.isDesktop}`);
      }
    }, { once: true });
    
    // 也监听 quick-settings-connected 事件
    document.addEventListener('quick-settings-connected', () => {
      const quickSettings = document.querySelector('quick-settings');
      if (quickSettings && typeof quickSettings.isDesktop !== 'undefined') {
        this.isDesktop = quickSettings.isDesktop;
        console.log(`ActionBox: Initialized after quick-settings-connected, isDesktop = ${this.isDesktop}`);
      }
    }, { once: true });
  }

  // 检查是否为桌面模式 - 使用本地缓存的状态
  isDesktopMode() {
    // 直接返回本地状态，这个状态通过事件监听器保持同步
    return this.isDesktop;
  }

  // 显示上下文菜单
  showContextMenu(event) {
    // 隐藏任何现有的上下文菜单
    this.hideAllContextMenus();
    
    // 根据当前模式设置菜单样式类
    this.contextMenu.className = 'context-menu';
    if (this.isDesktopMode()) {
      this.contextMenu.classList.add('desktop-mode');
    } else {
      this.contextMenu.classList.add('mobile-mode');
    }
    
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
    console.log(`Opening application in ${this.isDesktopMode() ? 'desktop' : 'mobile'} mode`);
    
    // 查找应用图标元素
    const slotElement = this.shadowRoot.querySelector("slot").assignedNodes()[0];
    if (slotElement) {
      // 如果是action-bookmark，直接调用其openBookmark方法
      if (slotElement.tagName === 'ACTION-BOOKMARK' && slotElement.openBookmark) {
        console.log('Calling openBookmark on action-bookmark');
        slotElement.openBookmark();
        return;
      }
      
      // 如果是action-activity，直接调用其startActivity方法
      if (slotElement.tagName === 'ACTION-ACTIVITY' && slotElement.startActivity) {
        console.log('Calling startActivity on action-activity');
        slotElement.startActivity();
        return;
      }
      
      // 如果是其他类型的元素，尝试触发点击
      if (slotElement.click) {
        console.log('Triggering click on slot element');
        slotElement.click();
      } else if (slotElement.children && slotElement.children[0] && slotElement.children[0].click) {
        console.log('Triggering click on first child element');
        slotElement.children[0].click();
      }
    }
    
    // 如果通过slot元素无法触发，尝试查找应用相关的数据并直接打开
    if (this.actionId) {
      console.log(`Attempting to open app with actionId: ${this.actionId}`);
      // 通过事件系统触发应用打开
      this.dispatchEvent(new CustomEvent('open-app', { 
        bubbles: true, 
        detail: { 
          actionId: this.actionId,
          fromDoubleClick: this.isDesktopMode()
        } 
      }));
    }
  }

  // 高亮应用（桌面模式单击效果）
  highlightApp() {
    // 先清除所有其他应用的高亮
    document.querySelectorAll('action-box').forEach(box => {
      if (box !== this) {
        box.classList.remove('selected');
      }
    });
    
    // 高亮当前应用
    this.classList.add('selected');
    console.log('Application highlighted');
    
    // 3秒后自动取消高亮
    setTimeout(() => {
      this.classList.remove('selected');
    }, 3000);
  }

  handleEvent(event) {
    if (event.type === "click") {
      if (this.cancelClick || this.isDragging) {
        event.preventDefault();
        this.cancelClick = false;
        this.isDragging = false;
        return;
      }

      // 桌面模式：双击打开应用
      if (this.isDesktopMode()) {
        const now = Date.now();
        const timeSinceLastClick = now - this.lastClickTime;
        
        console.log(`Desktop mode click: timeSinceLastClick=${timeSinceLastClick}, doubleClickDelay=${this.doubleClickDelay}`);
        
        if (timeSinceLastClick < this.doubleClickDelay && this.lastClickTime > 0) {
          // 双击检测到，立即打开应用
          console.log('Double-click detected in desktop mode - opening application');
          if (this.clickTimeout) {
            clearTimeout(this.clickTimeout);
            this.clickTimeout = null;
          }
          this.openApplication();
          this.lastClickTime = 0; // 重置点击时间
        } else {
          // 第一次点击或时间间隔太长，等待可能的第二次点击
          console.log('First click in desktop mode - waiting for potential double-click');
          this.lastClickTime = now;
          
          // 清除之前的timeout
          if (this.clickTimeout) {
            clearTimeout(this.clickTimeout);
          }
          
          this.clickTimeout = setTimeout(() => {
            // 单击处理（在桌面模式下不打开应用，只是选中效果）
            console.log('Single-click timeout - highlighting app');
            this.highlightApp();
            this.clickTimeout = null;
            this.lastClickTime = 0; // 重置点击时间，为下次双击做准备
          }, this.doubleClickDelay);
        }
      } else {
        // 移动模式：单击直接打开应用
        console.log('Mobile mode click - opening application immediately');
        this.openApplication();
      }
      
      this.cancelClick = false;
      return;
    } else if (event.type === "pointerdown") {
      this.shadowRoot.addEventListener("pointerup", this, { once: true });
      let startPos = { x: event.screenX, y: event.screenY };
      let capturedPointerId = event.pointerId;
      this.isDragging = false; // 重置拖拽状态

      // 桌面模式：立即开始拖拽（类似Windows）
      if (this.isDesktopMode()) {
        // 桌面模式下，缩短长按时间，更快响应拖拽
        this.timer = window.setTimeout(() => {
          this.setPointerCapture(capturedPointerId);
          this.cancelClick = true;
          this.isDragging = true; // 标记为拖拽模式
          this.dispatchEvent(
            new CustomEvent("long-press", { bubbles: true, detail: startPos })
          );
        }, 100); // 桌面模式下100ms就开始拖拽
      } else {
        // 移动模式：保持原有的长按时间
        this.timer = window.setTimeout(() => {
          this.setPointerCapture(capturedPointerId);
          this.cancelClick = true;
          this.isDragging = true; // 标记为拖拽模式
          this.dispatchEvent(
            new CustomEvent("long-press", { bubbles: true, detail: startPos })
          );
        }, kLongPressDelay);
      }
    } else if (event.type === "pointerup") {
      if (this.timer) {
        window.clearTimeout(this.timer);
      }
    } else if (event.type === "contextmenu") {
      event.preventDefault();
      // 添加调试信息
      console.log(`ActionBox: Right-click detected, isDesktop = ${this.isDesktop}, isDesktopMode() = ${this.isDesktopMode()}`);
      
      // 无论是否为桌面模式都显示上下文菜单
      // 但在不同模式下菜单的样式和位置可能不同
      console.log('Right-click detected, showing context menu');
      this.showContextMenu(event);
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
