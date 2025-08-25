// <actions-wall> is a container to layout <action-box> components.


// const kMaxWidth = window
//   .getComputedStyle(document.body)
//   .getPropertyValue("--action-per-line");

class ActionsWall extends HTMLElement {
  constructor() {
    super();

    this.editing = null;

    this.store = new ActionsStore();
    // 将 store 实例设置为全局变量，以便 bootstrap.js 中的窗口大小调整功能可以访问
    window.actionsStore = this.store;
    
    this.store.addEventListener(
      "store-ready",
      () => {
        this.store.forEach((action) => {
          this.addAction(action);
        });
        // 在 store 准备好后触发自定义事件，通知其他模块
        document.dispatchEvent(new CustomEvent("store-ready", { detail: this.store }));
      },
      { once: true }
    );

    // 监听 position-updated 事件，自动更新对应 action-box 的位置
    this.store.addEventListener("position-updated", (event) => {
      this.handlePositionUpdate(event.detail);
    });

    // Listen for app related events.
    this.appsManager = window.apiDaemon.getAppsManager();
    this.appsManager.then((service) => {
      service.addEventListener(service.APP_INSTALLING_EVENT, (app) => {
        this.log(`Installing App ${JSON.stringify(app)}`);
      });

      service.addEventListener(
        service.APP_INSTALLED_EVENT,
        this.addAppAction.bind(this)
      );

      service.addEventListener(service.APP_UNINSTALLED_EVENT, (manifestUrl) => {
        this.log(`App ${manifestUrl} uninstalled!`);
        // Remove the action for this manifest url if it exists.
        let action = this.store.getActionByManifestUrl(manifestUrl);
        if (action) {
          let box = window[`action-${action.id}`];
          if (box) {
            this.store.removeAction(action.id);
            this.removeActionNode(box);
          } else {
            this.error(`No DOM node found for action with id ${action.id}`);
          }
        }
      });
    });
  }

  handlePositionUpdate(detail) {
    const { actionId, oldPosition, newPosition } = detail;
    
    // 查找对应的 action-box 元素
    const actionBox = this.querySelector(`#action-${actionId}`);
    if (actionBox) {
      // 更新位置属性，这会自动触发 action-box 的位置更新
      actionBox.setAttribute("position", newPosition);
      this.log(`Updated UI position for action ${actionId} from ${oldPosition} to ${newPosition}`);
    } else {
      this.error(`No action-box found for action ${actionId}`);
    }
  }

  log(msg) {
    console.log(`ActionsWall: ${msg}`);
  }

  error(msg) {
    console.error(`ActionsWall: ${msg}`);
  }

  async addAppAction(app) {
    this.log(`Adding App ${JSON.stringify(app)}`);

    // Don't add Tiles to the homescreen when installing them.
    if (app.updateUrl.protocol === "tile:") {
      return;
    }

    let summary = await window.appsManager.getSummary(app);
    summary.kind = "bookmark";
    this.addNewAction(summary);
  }

  createBox(action, inner) {
    let box = new ActionBox();
    box.setAttribute("position", action.position);
    box.appendChild(inner);
    box.actionId = action.id;
    box.setAttribute("id", `action-${action.id}`);
    box.classList.add("adding");
    this.appendChild(box);
    window.setTimeout(() => {
      box.classList.remove("adding");
    }, 0);
    return box;
  }

  addAction(action) {
    if (action.kind === "bookmark") {
      this.createBox(action, new ActionBookmark(action));
    } else if (action.kind === "activity") {
      this.createBox(action, new ActionActivity(action));
    } else if (action.kind === "widget") {
      let box = this.createBox(action, new ActionWidget(action));
      box.classList.add(`widget-${action.size}`);
    } else {
      this.error(`Unsupported action kind: ${action.kind}`);
    }
  }

  async addNewAction(action) {
    const kMaxWidth = window
      .getComputedStyle(document.body)
      .getPropertyValue("--action-per-line");
    // Find a empty spot for this new action.
    let empty = this.store.getEmptySlots(kMaxWidth);
    action.position = empty.values().next().value;
    let array = new Uint8Array(8);
    window.crypto.getRandomValues(array);
    let hex = "";
    array.forEach((i) => {
      hex += i.toString(16).padStart(2, "0");
    });
    action.id = hex;

    try {
      const stored = await this.store.addAction(action);
      this.addAction(stored);
    } catch (e) {
      this.error(`Failed to add action: ${e}`);
    }
  }

  // Creates a simple action-box with ghost content.
  addGhostAt(position, action) {
    let box = document.createElement("action-box");
    box.setAttribute("position", position);
    box.classList.add("ghost");

    action?.classList.forEach((className) => {
      if (className.startsWith("widget-")) {
        box.classList.add(className);
      }
    });
    this.appendChild(box);
    box.setGhostState(true);
    return box;
  }

  removeAllGhosts() {
    this.querySelectorAll(".ghost").forEach((node) => {
      this.removeChild(node);
    });
  }

  removeActionNode(node) {
    node.addEventListener(
      "transitionend",
      () => {
        node.remove();
      },
      { once: true }
    );
    node.classList.add("removing");
  }

  connectedCallback() {
    let shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <link rel="stylesheet" href="components/actions_wall.css">
      <div>
        <slot> </slot>
      </div>
      `;

    this.addEventListener("delete-action", async (event) => {
      try {
        this.store.removeAction(event.detail);
        this.removeActionNode(event.target);
      } catch (e) {
        console.error(`Failed to remove action from the store: ${e}`);
      }
    });

    this.addEventListener("long-press", (event) => {
      location.hash = "lock";

      let target = event.target;

      // Reset the editing state.
      this.editing = {
        box: event.target,
        startCoords: event.detail,
      };

      // Animate the icon but stop the transition in x,y
      this.editing.box.animate(true);
      this.editing.box.classList.add("no-transition");

      const kMaxWidth = window
        .getComputedStyle(document.body)
        .getPropertyValue("--action-per-line");

      let emptySlots = this.store.getEmptySlots(kMaxWidth);
      emptySlots.forEach((position) => {
        // Add a "ghost" box that will be used for visual effect and hit testing.
        this.addGhostAt(position, target);
      });

      // Add a ghost at the curent position (which is not considered empty)
      // so we can hover on it.
      this.addGhostAt(target.getAttribute("position"), target);

      navigator.vibrate(100);

      this.addEventListener("pointermove", this);
      this.addEventListener("pointerup", this, { once: true });
    });
  }

  findHoverBox(element) {
    while (element && element.localName !== "action-box") {
      element = element.parentNode;
    }
    return element;
  }

  // 检查是否为桌面模式
  isDesktopMode() {
    // 检查 QuickSettings 的状态
    const quickSettings = document.querySelector('quick-settings');
    if (quickSettings && typeof quickSettings.isDesktop !== 'undefined') {
      return quickSettings.isDesktop;
    }
    
    // 检查 wallpaperManager
    if (window.wallpaperManager && typeof window.wallpaperManager.isDesktop !== 'undefined') {
      return window.wallpaperManager.isDesktop;
    }
    
    // 默认为桌面模式
    return true;
  }

  // 交换两个应用的位置（桌面模式下的拖拽交换）
  swapPositions(draggingBox, targetPosition) {
    // 找到目标位置的应用
    const targetBox = this.querySelector(`action-box[position="${targetPosition}"]`);
    
    if (targetBox && targetBox !== draggingBox) {
      const draggingPosition = draggingBox.getAttribute("position");
      const draggingActionId = draggingBox.actionId;
      const targetActionId = targetBox.actionId;
      
      console.log(`Swapping positions: ${draggingActionId} (${draggingPosition}) <-> ${targetActionId} (${targetPosition})`);
      
      // 交换位置属性
      draggingBox.setAttribute("position", targetPosition);
      targetBox.setAttribute("position", draggingPosition);
      
      // 更新存储中的位置信息
      this.store.updatePositionFor(draggingActionId, targetPosition);
      this.store.updatePositionFor(targetActionId, draggingPosition);
      
      console.log(`Successfully swapped positions`);
    } else if (!targetBox) {
      // 如果没有找到目标应用，直接移动到目标位置
      console.log(`No app at target position ${targetPosition}, moving directly`);
      draggingBox.setAttribute("position", targetPosition);
      this.store.updatePositionFor(draggingBox.actionId, targetPosition);
    } else {
      console.log(`Cannot swap: draggingBox and targetBox are the same`);
    }
  }

  handleEvent(event) {
    if (event.type === "pointerup") {
      this.removeEventListener("pointermove", this);
      this.removeAllGhosts();
  
      let box = this.editing.box;
      box.animate(false);
      box.classList.remove("no-transition");
  
      // 检查是否为桌面模式
      const isDesktopMode = this.isDesktopMode();
      console.log(`Drag ended in ${isDesktopMode ? 'desktop' : 'mobile'} mode`);
      
      if (this.editing.dropPosition) {
        const currentPosition = box.getAttribute("position");
        console.log(`Attempting to move from ${currentPosition} to ${this.editing.dropPosition}`);
        
        if (isDesktopMode) {
          // 桌面模式：直接移动到目标位置，即使位置被占用也要进行交换
          if (this.store.isPositionOccupied(this.editing.dropPosition)) {
            console.log('Target position occupied - swapping positions in desktop mode');
            // 如果目标位置被占用，进行位置交换
            this.swapPositions(box, this.editing.dropPosition);
          } else {
            console.log('Target position empty - moving directly in desktop mode');
            // 目标位置空闲，直接移动
            box.setAttribute("position", this.editing.dropPosition);
            this.store.updatePositionFor(box.actionId, this.editing.dropPosition);
          }
        } else {
          // 移动模式：只有在目标位置为空时才更新位置
          if (!this.store.isPositionOccupied(this.editing.dropPosition)) {
            console.log('Moving to empty position in mobile mode');
            box.setAttribute("position", this.editing.dropPosition);
            this.store.updatePositionFor(box.actionId, this.editing.dropPosition);
          } else {
            console.log('Target position occupied - move cancelled in mobile mode');
          }
        }
      } else {
        console.log('No valid drop position - returning to original position');
      }
  
      // 无论是否成功移动，都重置位置到原始状态
      box.translateBy(0, 0);
  
      this.editing = null;
      location.hash = "unlock";
    } else if (event.type === "pointermove") {
      // Find if we are intersecting with a box
      let hover = this.findHoverBox(
        document.elementFromPoint(event.clientX, event.clientY)
      );
      
      const isDesktopMode = this.isDesktopMode();
      
      if (hover) {
        const position = hover.getAttribute("position");
        const isOccupied = !hover.classList.contains("ghost") && 
                           this.store.isPositionOccupied(position);
        
        if (isDesktopMode) {
          // 桌面模式：允许拖拽到任何位置，包括被占用的位置
          if (this.editing.activeGhost && this.editing.activeGhost !== hover) {
            this.editing.activeGhost.setGhostActive(false);
          }
          hover.setGhostActive(true, true); // 在桌面模式下总是显示为可用
          this.editing.activeGhost = hover;
          this.editing.dropPosition = position;
        } else {
          // 移动模式：检查目标位置是否已被占用
          if (isOccupied) {
            // 目标位置已被占用，取消激活当前 ghost
            if (this.editing.activeGhost) {
              this.editing.activeGhost.setGhostActive(false);
              this.editing.activeGhost = null;
            }
            this.editing.dropPosition = null;
          } else {
            // 目标位置可用，正常处理
            if (this.editing.activeGhost && this.editing.activeGhost !== hover) {
              this.editing.activeGhost.setGhostActive(false);
            }
            hover.setGhostActive(true);
            this.editing.activeGhost = hover;
            this.editing.dropPosition = position;
          }
        }
      }
  
      let deltaX = event.screenX - this.editing.startCoords.x;
      let deltaY = event.screenY - this.editing.startCoords.y;
      this.editing.box.translateBy(deltaX, deltaY);
    }
  }
  // handleEvent(event) {
  //   if (event.type === "pointerup") {
  //     this.removeEventListener("pointermove", this);
  //     this.removeAllGhosts();

  //     let box = this.editing.box;
  //     box.animate(false);
  //     box.classList.remove("no-transition");

  //     // Update the box position.
  //     box.translateBy(0, 0);
  //     let newPosition = this.editing.dropPosition;
  //     if (newPosition) {
  //       box.setAttribute("position", newPosition);
  //       this.store.updatePositionFor(box.actionId, newPosition);
  //     }

  //     this.editing = null;

  //     location.hash = "unlock";
  //   } else if (event.type === "pointermove") {
  //     // Find if we are intersecting with a box.
  //     let hover = this.findHoverBox(
  //       document.elementFromPoint(event.clientX, event.clientY)
  //     );
  //     if (hover) {
  //       // Change the "active ghost"
  //       if (this.editing.activeGhost && this.editing.activeGhost !== hover) {
  //         this.editing.activeGhost.setGhostActive(false);
  //       }
  //       hover.setGhostActive(true);
  //       this.editing.activeGhost = hover;
  //       this.editing.dropPosition = hover.getAttribute("position");
  //     }

  //     let deltaX = event.screenX - this.editing.startCoords.x;
  //     let deltaY = event.screenY - this.editing.startCoords.y;
  //     // Update the translation of the box.
  //     this.editing.box.translateBy(deltaX, deltaY);
  //   }
  // }


}

customElements.define("actions-wall", ActionsWall);
