// <window-manager> custom element: a simple window manager.

// Manages key binding state for the window manager.
const kCarouselModifier =
  embedder.sessionType == "session" ? "Alt" : window.config.metaOrControl;

class WindowManagerKeys {
  constructor(wm) {
    this.wm = wm;
    this.isCarouselOpen = false;

    this.isModifierDown = false;
    this.isShiftDown = false;
    this.isCtrlDown = false;
    this.isAltDown = false;
    this.index = -1;

    embedder.addSystemEventListener("keydown", this, true);
    embedder.addSystemEventListener("keyup", this, true);
  }

  changeCarouselState(open) {
    this.isCarouselOpen = open;
  }

  switchToCurrentFrame() {
    if (!this.isCarouselOpen) {
      return;
    }

    let id = document
      .querySelector(`#carousel-screenshot-${this.index}`)
      .getAttribute("frame");
    actionsDispatcher.dispatch("close-carousel");
    this.wm.switchToFrame(id);
  }

  handleEvent(event) {
    // console.log(
    //   `WindowManagerKeys Got ${event.type} event ${event.key} (open=${this.isCarouselOpen})`
    // );

    if (event.key === kCarouselModifier) {
      this.isModifierDown = event.type === "keydown";

      // Switch to current frame when releasing the [modifier] key.
      if (!this.isModifierDown) {
        this.switchToCurrentFrame();
      }
    }

    if (event.key === "Shift") {
      this.isShiftDown = event.type === "keydown";
    }

    if (event.key === "Alt") {
      this.isAltDown = event.type === "keydown";
    }

    if (event.key === window.config.metaOrControl) {
      this.isCtrlDown = event.type === "keydown";
    }

    let frameCount = Object.keys(this.wm.frames).length - 1;

    // [Alt] + [1..8] switch to the given frame if it exists.
    // [Alt] + [9] switches to the last frame.
    if (
      event.type === "keydown" &&
      this.isAltDown &&
      "123456789".includes(event.key)
    ) {
      let children = this.wm.windows.childNodes;
      if (event.key === "9") {
        this.wm.switchToFrame(children[frameCount].getAttribute("id"));
      } else {
        let n = event.key | 0;
        if (n <= frameCount) {
          // Frame 0 is the homescreen but we skip it.
          this.wm.switchToFrame(children[n].getAttribute("id"));
        }
      }
    }

    // [modifier] + [Tab] allows switching to the next frame, or to the
    // previous one if [Shift] is pressed.
    if (event.type === "keydown" && event.key === "Tab") {
      let change = this.isShiftDown ? -1 : 1;

      if (!this.isCarouselOpen && this.isModifierDown) {
        actionsDispatcher.dispatch("open-carousel");
        this.index = 0;
        // Find the index of the currently selected frame.
        const selectedFrame = document.querySelector(
          "window-manager div.selected"
        );
        if (selectedFrame) {
          // The id attribute is carousel-screenshot-${this.index}
          this.index = selectedFrame.getAttribute("id").split("-")[2] | 0;
        }
      } else if (this.isCarouselOpen && this.isModifierDown) {
        this.index = this.index + change;
        if (this.index < 0) {
          this.index = frameCount - 1;
        }
        if (this.index >= frameCount) {
          this.index = 0;
        }
        document
          .querySelector(`#carousel-screenshot-${this.index}`)
          .scrollIntoView({
            behavior: "smooth",
            block: "end",
            inline: "center",
          });
      }
    }

    // Close the carousel with [Escape]
    if (
      event.type === "keyup" &&
      event.key === "Escape" &&
      this.isCarouselOpen
    ) {
      actionsDispatcher.dispatch("close-carousel");
    }

    // Switch to the current frame with [Enter]
    if (event.type === "keyup" && event.key === "Enter") {
      this.switchToCurrentFrame();
    }

    // Switch to the homescreen frame with [Home]
    if (event.type === "keyup" && event.key === "Home") {
      this.wm.goHome();
    }

    // Open the url editor with [Ctrl] + [l]
    if (this.isCtrlDown && event.type === "keydown" && event.key === "l") {
      let frame = this.wm.currentFrame();
      if (!frame?.config.isHomescreen) {
        actionsDispatcher.dispatch("open-url-editor", frame.state.url);
      }
    }

    // Open the homescreen "new tab" editor with [Ctrl] + [t]
    // We need to switch to the homescreen first.
    if (
      this.isCtrlDown &&
      event.type === "keydown" &&
      event.key === "t" &&
      !window.lockscreen.isLocked()
    ) {
      actionsDispatcher.dispatch("new-tab");
    }

    // Do a WebRender Capture with [Ctrl] + [Shift] + [w]
    if (this.isCtrlDown && this.isShiftDown && event.key === "w") {
      embedder.wrCapture();
    }

    // Close the current tab with [Ctrl] + [w]
    if (
      this.isCtrlDown &&
      event.type === "keydown" &&
      event.key === "w" &&
      !this.isCarouselOpen
    ) {
      this.wm.closeFrame();
    }

    // Reload the current tab with [Ctrl] + [r]
    // Zoom in the current tab with [Ctrl] + [+] and [Ctrl] + [=]
    // Zoom out the current tab with [Ctrl] + [-]
    // Reset zoom for the current tab with [Ctrl] + [0]
    if (this.isCtrlDown && event.type === "keydown" && !this.isCarouselOpen) {
      if (event.key === "r") {
        this.wm.reloadCurrentFrame(this.isShiftDown);
      } else if (event.key === "+") {
        this.wm.zoomInCurrentFrame();
      } else if (event.key === "=") {
        this.wm.zoomInCurrentFrame();
      } else if (event.key === "-") {
        this.wm.zoomOutCurrentFrame();
      } else if (event.key === "0") {
        this.wm.zoomResetCurrentFrame();
      }
    }

    // Go back in history with [Alt] [<-] and
    // go forward with [Alt] [->]
    if (this.isAltDown && event.type === "keydown" && !this.isCarouselOpen) {
      if (event.key === "ArrowLeft") {
        this.wm.goBack();
      } else if (event.key === "ArrowRight") {
        this.wm.goForward();
      }
    }
  }
}

class CaretManager {
  constructor() {
    this.caretSelection = document.getElementById("caret-selection");

    embedder.addEventListener(
      "caret-state-changed",
      this.caretStateChanged.bind(this)
    );
    actionsDispatcher.addListener("lockscreen-locked", () => {
      this.caretSelection.classList.add("hidden");
    });

    ["copy", "search", "select-all", "share"].forEach((name) => {
      let elem = document.getElementById(`selection-${name}`);
      elem.addEventListener("pointerdown", this, { capture: true });
    });

    this.selectedText = null;
    this.previousTop = window.innerWidth / 2;
    this.previousLeft = window.innerHeight / 2;
    this.hideTimer = null;
  }

  handleEvent(event) {
    let id = event.target.getAttribute("id");
    switch (id) {
      case "selection-copy":
        embedder.doSelectionAction("copy");
        break;
      case "selection-select-all":
        embedder.doSelectionAction("selectall");
        break;
      case "selection-share":
        let act = new WebActivity("share", { text: this.selectedText });
        act.start();
        break;
      case "selection-search":
        window.utils.randomSearchEngineUrl(this.selectedText).then((url) => {
          wm.openFrame(url, {
            activate: true,
            details: { search: this.selectedText },
          });
        });
        break;
      default:
        return;
    }
    event.stopPropagation();
    this.caretSelection.classList.add("hidden");
  }

  caretStateChanged(event) {
    let { rect, commands, caretVisible, selectedTextContent } = event.detail;

    if (caretVisible) {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }

      if (commands.canCopy) {
        document.getElementById("selection-copy").classList.remove("hidden");
      } else {
        document.getElementById("selection-copy").classList.add("hidden");
      }

      if (commands.canSelectAll) {
        document
          .getElementById("selection-select-all")
          .classList.remove("hidden");
      } else {
        document.getElementById("selection-select-all").classList.add("hidden");
      }

      this.selectedText = selectedTextContent;

      let buttons = this.caretSelection.getBoundingClientRect();

      let top =
        buttons.height != 0 ? rect.top - buttons.height - 5 : this.previousTop;
      if (top < 0) {
        this.caretSelection.classList.add("hidden");
        return;
      }
      this.caretSelection.style.top = `${top}px`;

      // Try to center the buttons with the selection, but make
      // sure it's fully on screen.
      let left =
        buttons.width != 0
          ? rect.left + rect.width / 2 - buttons.width / 2
          : this.previousLeft;
      if (left < 5) {
        left = 5;
      }
      if (left + buttons.width + 5 > window.innerWidth) {
        left = window.innerWidth - buttons.width - 5;
      }
      this.caretSelection.style.left = `${left}px`;

      this.previousTop = top;
      this.previousLeft = left;

      this.caretSelection.classList.remove("hidden");
    } else {
      this.hideTimer = setTimeout(() => {
        this.caretSelection.classList.add("hidden");
      }, 500);
    }
  }
}

class WindowManager extends HTMLElement {
  constructor() {
    super();
    this.keys = new WindowManagerKeys(this);
    this.log(`constructor`);

    this.caretManager = new CaretManager();
  }

  log(msg) {
    console.log(`WindowManager: ${msg}`);
  }

  error(msg) {
    console.error(`WindowManager: ${msg}`);
  }

  connectedCallback() {
    // FIXME: We can't use the shadow DOM here because that makes loading <web-view> fail.
    // let shadow = this.attachShadow({ mode: "open" });

    // The window manager contains 2 elements decked on top of each other:
    // - the swipable content windows.
    // - the carousel view.
    this.container = document.createElement("div");
    this.container.classList.add("main");
    this.container.innerHTML = `<link rel="stylesheet" href="components/window_manager.css">
    <div class="windows"></div>
    <div class="carousel hidden"></div>
    `;
    this.appendChild(this.container);

    this.windows = this.querySelector(".windows");
    this.carousel = this.querySelector(".carousel");

    let options = {
      root: this.windows,
      rootMargin: "0px",
      threshold: [0, 0.75, 1],
    };

    let intersectionCallback = (entries, observer) => {
      let foundExpected = false;

      entries.forEach((entry) => {
        // this.log(
        //   `Intersection: isIntersecting=${
        //     entry.isIntersecting
        //   } target=${entry.target.getAttribute("id")} ratio=${
        //     entry.intersectionRatio
        //   }`
        // );

        // Change the active status of the webview based on its visibility in
        // the container.
        entry.target.active = entry.isIntersecting;
        let frameId = entry.target.getAttribute("id");
        let frame = this.frames[frameId];
        if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
          // This is the "really" active frame, use it as a source of UI state.
          if (this.expectedActiveFrame && this.expectedActiveFrame == frameId) {
            foundExpected = true;
          }

          // Ensure previous frame is properly deactivated before activating new one
          if (this.activeFrame && this.activeFrame !== frameId) {
            let prevFrame = this.frames[this.activeFrame];
            if (prevFrame) {
              prevFrame.deactivate();
            }
          }

          frame.activate();
          if (this.activeFrame != frameId) {
            actionsDispatcher.dispatch("close-url-editor");
          }
          this.activeFrame = frameId;
          // Ensure proper visibility management
          this.ensureActiveFrameVisibility();
        } else if (frame) {
          // The frame may have been removed if we just closed it.
          // Only deactivate if this frame is currently active to prevent
          // deactivating frames that are still visible during transitions
          if (this.activeFrame === frameId && entry.intersectionRatio < 0.25) {
            frame.deactivate();
          }
        }
      });

      if (foundExpected && this.activeFrame != this.expectedActiveFrame) {
        let frame = this.frames[this.activeFrame];
        frame.deactivate();
        this.activeFrame = this.expectedActiveFrame;
        frame = this.frames[this.activeFrame];
        frame.activate();
        this.expectedActiveFrame = null;
      }
    };

    this.intersectionObserver = new IntersectionObserver(
      intersectionCallback,
      options
    );

    this.frames = {};
    this.frameId = 0;
    this.activeFrame = null;
    this.startedAt = {};
    this.isCarouselOpen = false;
    actionsDispatcher.addListener("maybeOpenURL", (_name, data_url) => {
      console.log("WindowManager: Received 'maybeOpenURL' command from system");
      // 直接调用 homescreen.js 暴露的函数
      const homescreenFrame = this.homescreenFrame();
      if (homescreenFrame && homescreenFrame.webView) {
        // 1. 获取当前的 src URL
        let currentSrc = homescreenFrame.webView.src;

        // 2. 创建一个 URL 对象
        const url = new URL(currentSrc);

        // 3. 构造要发送的数据对象
        const messageData = {
          action: "maybeOpenURL",
          url: data_url,
        };

        const newHash = encodeURIComponent(JSON.stringify(messageData));
        url.hash = newHash;

        const newSrc = url.toString();

        if (newSrc !== currentSrc) {
          console.log("Updating webView src to send message via hash:", newSrc);
          homescreenFrame.webView.setAttribute('src', newSrc);
        } else {
          console.log("Hash is already up-to-date.");
        }

        return;
      }
    });
    actionsDispatcher.addListener("go-back", this.goBack.bind(this));
    actionsDispatcher.addListener("go-forward", this.goForward.bind(this));
    actionsDispatcher.addListener("go-home", this.goHome.bind(this));
    actionsDispatcher.addListener(
      "open-carousel",
      this.openCarousel.bind(this)
    );
    actionsDispatcher.addListener(
      "close-carousel",
      this.closeCarousel.bind(this)
    );
    actionsDispatcher.addListener("set-screen-off", () => {
      this.sleep();
    });
    // actionsDispatcher.addListener("set-screen-on", () => {
    //   this.wakeUp();
    // });
    actionsDispatcher.addListener("lockscreen-locked", () => {
      this.sleep();
    });
    actionsDispatcher.addListener("lockscreen-unlocked", () => {
      this.wakeUp();
    });
    actionsDispatcher.addListener("frame-split-screen", () => {
      this.splitScreen();
    });

    actionsDispatcher.addListener("new-tab", async () => {
      this.goHome();
      this.homescreenFrame().focus();
      window.XacHomescreen.newTab();
    });

    // This event is sent when calling WindowClient.focus() from a Service Worker.
    window.addEventListener("framefocusrequested", (event) => {
      // event.target is the xul:browser

      // We want to switch back to the calling page when the activity
      // is closed, so we need to update config.previousFrame of
      // the activity content-window in this case to point to the current
      // active frame.
      this.switchToWebView(event.target.parentElement, true);
    });
  }

  reloadCurrentFrame(forced = false) {
    this.activeFrame && this.frames[this.activeFrame].reload(forced);
  }

  zoomInCurrentFrame() {
    this.activeFrame && this.frames[this.activeFrame].zoomIn();
  }

  zoomOutCurrentFrame() {
    this.activeFrame && this.frames[this.activeFrame].zoomOut();
  }

  zoomResetCurrentFrame() {
    this.activeFrame && this.frames[this.activeFrame].zoomReset();
  }

  toggleMutedState(frameId) {
    this.frames[frameId]?.toggleMutedState();
  }

  splitScreen() {
    if (!this.activeFrame) {
      return;
    }
    let frame = this.frames[this.activeFrame];
    // Don't split the homescreen and already splitted content windows.
    if (frame.config.isHomescreen || frame.classList.contains("split")) {
      return;
    }

    // Split the requesting frame.
    frame.classList.add("split");
    frame.classList.add("split-left");
    frame.addEventListener("pointerdown", this, { capture: true });
    frame.deactivate();

    // Open a new frame and configure it to split mode.
    this.openFrame(`about:blank`, {
      activate: true,
      split: true,
      insertAfter: frame,
    });
    this.frames[this.activeFrame].classList.add("split-right");

    actionsDispatcher.dispatch("open-url-editor", null);
  }

  sleep() {
    this.activeFrame && this.frames[this.activeFrame].deactivate();
  }

  wakeUp() {
    if (this.activeFrame) {
      let frame = this.frames[this.activeFrame];
      frame.activate();
    }
  }

  // Show the <select> UI in the active frame context.
  showSelectUI(data) {
    if (this.activeFrame) {
      this.frames[this.activeFrame].showSelectUI(data);
    }
  }

  // Open a new url with a given configuration.
  // Recognized configuration properties:
  // isHomescreen (bool) : the homescreen gets a transparent background and can't be closed.
  // isCaptivePortal (bool) : this frame will be used for wifi captive portal login only.
  // activate (bool) : if true, selects this frame as the active one.
  // details: { title, icon, backgroundColor } : metadata usable for the splash screen.
  //
  // Returns the <web-view> in which the content is loaded.
  openFrame(url = "about:blank", config = {}) {
    this.log(`openFrame ${url}`);

    // If the FTU is not completed, deny other frame openings except the homescreen.
    // This is useful to prevent WebExtensions "first run" pages to open
    // when installing recommended extensions during the FTU.
    if (!window.config.ftuDone && !config.isFtu && !config.isHomescreen) {
      this.error(`FTU is running, denying frame creation for ${url}`);
      return null;
    }

    // Close the webext action popup if it's open.
    document.querySelector("webext-browser-action").hide();

    // If a frame was opened from the same url, switch to it.
    let startId = this.startedAt[url];
    let reuse =
      startId &&
      this.frames[startId] &&
      !!config.details?.privatebrowsing ==
      this.frames[startId].state.privatebrowsing;
    if (reuse) {
      if (this.isCarouselOpen) {
        actionsDispatcher.dispatch("close-carousel");
      }
      this.switchToFrame(startId);
      return this.frames[startId].webView;
    }

    let attrId = `frame${this.frameId}`;
    this.frameId += 1;

    config.previousFrame = this.activeFrame;

    // Create a new ContentWindow, and add it to the set of frames.
    let contentWindow = document.createElement("content-window");
    contentWindow.setAttribute("id", attrId);

    contentWindow.classList.add("opening");
    contentWindow.addEventListener(
      "animationend",
      function () {
        contentWindow.classList.remove("opening");
      },
      { once: true }
    );

    config.startUrl = url;

    if (config.remote === undefined) {
      config.remote = true;
    }

    // Activities can use the "fullscreen" disposition to launch
    // in fullscreen mode.
    if (config.disposition === "fullscreen") {
      let details = config.details || {};
      details.display = "fullscreen";
      config.details = details;
    }

    if (config.isHomescreen) {
      this.homescreenId = attrId;
      config.disableContentBlocking = true;
    }

    if (config.isCaptivePortal) {
      this.captivePortalId = attrId;
    }

    config.id = attrId;

    let isInlineActivity = config.disposition === "inline";
    config.isInlineActivity = isInlineActivity;

    contentWindow.setConfig(config);

    if (isInlineActivity) {
      let current = this.frames[this.activeFrame];
      current.deactivate();
      current.addInlineActivity(contentWindow);
      contentWindow.activate();
      return contentWindow.webView;
    }

    this.intersectionObserver.observe(contentWindow);

    if (config?.insertAfter?.nextElementSibling) {
      this.windows.insertBefore(
        contentWindow,
        config.insertAfter.nextElementSibling
      );
    } else {
      this.windows.appendChild(contentWindow);
    }

    this.frames[attrId] = contentWindow;
    contentWindow.goTo(url);

    if (config.activate) {
      if (this.isCarouselOpen) {
        actionsDispatcher.dispatch("close-carousel");
      }
      this.switchToFrame(attrId);
    }

    this.startedAt[url] = attrId;

    if (config.split) {
      contentWindow.classList.add("split");
      contentWindow.addEventListener("pointerdown", this, { capture: true });
    }

    this.updateFrameList();

    return contentWindow.webView;
  }

  // Specialized version of openFrame() tailored for about: pages.
  openAbout(url) {
    if (!url.startsWith("about:")) {
      return;
    }

    this.openFrame(url, { remote: false, activate: true });
  }

  handleEvent(event) {
    let contentWindow = event.target;
    while (contentWindow && contentWindow.localName !== "content-window") {
      contentWindow = contentWindow.parentNode;
    }

    if (!contentWindow?.classList.contains("split")) {
      return;
    }

    let nextActive = contentWindow.getAttribute("id");
    if (nextActive === this.activeFrame) {
      return;
    }

    // Activate the frame that received the pointerdown event.
    this.frames[this.activeFrame].deactivate();
    this.activeFrame = nextActive;
    this.frames[this.activeFrame].activate();
    this.switchToFrame(attrId);
  }

  currentFrame() {
    return this.activeFrame ? this.frames[this.activeFrame] : null;
  }

  currentWebExtensionTabId() {
    return this.currentFrame()?.webView._extensionId;
  }

  goBack() {
    this.activeFrame && this.frames[this.activeFrame].goBack();
  }

  goForward() {
    this.activeFrame && this.frames[this.activeFrame].goForward();
  }

  closeFrame(id = "<current>", goTo = null) {
    let frame = null;
    if (id === "<current>") {
      id = this.activeFrame;
      frame = this.frames[this.activeFrame];
    } else if (this.frames[id]) {
      frame = this.frames[id];
    }

    if (id == this.homescreenId) {
      this.error("WindowManager: can't close the homescreen!!");
      return;
    }

    if (!frame) {
      return;
    }

    frame.removeEventListener("pointerdown", this, { capture: true });

    // If this frame is a split-screen one, we need to:
    // - figure out if it's a left or right one.
    // - mark the other frame from the pair as un-split.
    if (frame.classList.contains("split")) {
      let toUnsplit;
      if (frame.classList.contains("split-left")) {
        toUnsplit = frame.nextElementSibling;
        toUnsplit.classList.remove("split-right");
      } else if (frame.classList.contains("split-right")) {
        toUnsplit = frame.previousElementSibling;
        toUnsplit.classList.remove("split-left");
      }
      toUnsplit.classList.remove("split");
    }

    frame.cleanup();
    frame.remove();
    frame = null;
    delete this.frames[id];

    // Remove the frame from the list of start points.
    let startAt = null;
    for (let url in this.startedAt) {
      if (this.startedAt[url] == id) {
        startAt = url;
      }
    }
    if (startAt) {
      delete this.startedAt[startAt];
    }

    // Go to the homescreen.
    if (goTo && this.frames[goTo]) {
      this.switchToFrame(goTo);
    } else {
      this.goHome();
    }

    this.updateFrameList();
    this.dispatchEvent(new Event("frameclosed"));
  }

  updateFrameList() {
    let list = [];
    let frame = this.windows.firstElementChild;
    while (frame) {
      if (!frame.config.isHomescreen) {
        const { title, icon } = frame.state;
        let id = frame.getAttribute("id");
        list.push({
          id,
          title,
          icon,
          isPlayingAudio: frame.isPlayingAudio,
          audioMuted: frame.audioMuted,
        });
      }
      frame = frame.nextElementSibling;
    }

    actionsDispatcher.dispatch("update-frame-list", list);
  }

  switchToFrame(id, behavior = "instant", updatePreviousFrame = false) {
    // If the window-content is already displayed (eg. inactive split frame),
    // do a manual swap of the curent active frame for the new one.
    let frame = this.frames[this.activeFrame];
    if (frame && frame.classList.contains("split")) {
      let bounding = frame.getBoundingClientRect();
      let visible =
        bounding.top >= 0 &&
        bounding.left >= 0 &&
        bounding.bottom <= window.innerHeight &&
        bounding.right <= window.innerWidth;
      if (visible) {
        frame.deactivate();
        this.activeFrame = id;
        frame = this.frames[this.activeFrame];
        frame.activate();
        return;
      }
    }

    // Immediately deactivate the current active frame to prevent overlap
    if (this.activeFrame && this.activeFrame !== id) {
      let currentFrame = this.frames[this.activeFrame];
      if (currentFrame) {
        currentFrame.deactivate();
      }
    }

    if (updatePreviousFrame) {
      this.frames[id].config.previousFrame = this.activeFrame;
    }

    // Pre-activate the target frame before scrolling to it
    let targetFrame = this.frames[id];
    if (targetFrame) {
      targetFrame.activate();
      this.activeFrame = id;
      // Ensure visibility is properly managed
      this.ensureActiveFrameVisibility();
    }

    document.querySelector(`#${id}`).scrollIntoView({
      behavior,
      block: "end",
      inline: "center",
    });

    // In split mode, the activated frame may not be the correct one.
    this.expectedActiveFrame = id;
  }

  forceFrameStateUpdate(id) {
    let frame = this.frames[id];
    if (frame) {
      frame.dispatchStateUpdate(true);
    }
  }

  switchToWebView(webView, updatePreviousFrame = false) {
    for (let id in this.frames) {
      if (webView == this.frames[id].webView) {
        this.switchToFrame(id, "instant", updatePreviousFrame);
        return;
      }
    }
  }

  goHome() {
    if (this.homescreenId && this.activeFrame != this.homescreenId) {
      let activeFrame = this.frames[this.activeFrame];
      if (!activeFrame) {
        return;
      }

      activeFrame.classList.add("closing");
      activeFrame.addEventListener(
        "animationend",
        (event) => {
          activeFrame.classList.remove("closing");
          this.switchToFrame(this.homescreenId);
        },
        { once: true }
      );
    }
  }

  // Immediately switch to homescreen without animation
  goHomeInstant() {
    if (this.homescreenId && this.activeFrame != this.homescreenId) {
      this.switchToFrame(this.homescreenId, "instant");
    }
  }

  // Load a new homescreen url.
  switchHome(url, display) {
    if (!this.homescreenId) {
      return;
    }

    this.frames[this.homescreenId].navigateTo("home", { url, display });
  }

  homescreenFrame() {
    if (!this.homescreenId) {
      return null;
    }

    return this.frames[this.homescreenId];
  }

  openCaptivePortal() {
    this.openFrame("http://example.com", {
      activate: true,
      isCaptivePortal: true,
    });
  }

  closeCaptivePortal() {
    if (!this.captivePortalId) {
      return;
    }

    this.closeFrame(this.captivePortalId);
  }

  async openCarousel() {
    if (this.isCarouselOpen) {
      return;
    }

    // If apps list is open, close it first
    let appsList = document.getElementById("apps-list");
    if (appsList && appsList.classList.contains("open")) {
      appsList.close();
    }

    // Ensure we have a consistent background by going to homescreen first
    if (this.activeFrame !== this.homescreenId) {
      this.goHomeInstant();
      this.ensureActiveFrameVisibility();
    }

    let verticalMode = embedder.sessionType === "mobile";

    let updateCarouselAttr = (frameCount) => {
      this.carousel.classList.remove("single-row");
      this.carousel.classList.remove("two-rows");
      this.carousel.classList.remove("single-column");
      if (frameCount <= 2) {
        this.carousel.classList.add("single-row");
      } else if (frameCount <= 4) {
        this.carousel.classList.add("two-rows");
      }
      if (frameCount <= 1) {
        this.carousel.classList.add("single-column");
      }
    };

    // We don't put the homescreen in the carousel but we add the new-tab
    // card so the frame count is as if we added the homescreen.
    let frameCount = Object.keys(this.frames).length;

    // Keep the 75% vs 50% in sync with this rule in window_manager.css :
    // window-manager .carousel > div:not(.empty-carousel)
    let screenshotPercent = embedder.sessionType === "mobile" ? 75 : 50;
    let marginPercent = (100 - screenshotPercent) / 2;

    if (verticalMode) {
      this.carousel.classList.add("vertical");
      updateCarouselAttr(frameCount);
    } else {
      this.carousel.style.gridTemplateColumns = `${marginPercent}% repeat(${frameCount}, ${screenshotPercent}%) ${marginPercent}%`;
      this.carousel.classList.remove("vertical");
    }

    // Add the elements to the carousel.
    this.carousel.innerHTML = "";

    let options = {
      root: this.carousel,
      rootMargin: "0px",
      threshold: [0, 0.25, 0.5, 1],
    };

    let intersectionCallback = (entries, observer) => {
      // Avoid oscillation effect when reaching the edges.
      let overscroll = false;
      entries.forEach((entry) => {
        if (
          entry.intersectionRatio == 1 &&
          entry.target.classList.contains("padding")
        ) {
          overscroll = true;
        }
      });
      if (overscroll) {
        return;
      }

      entries.forEach((entry) => {
        let target = entry.target.getAttribute("frame");
        if (!target) {
          return;
        }

        let ratio = entry.intersectionRatio;

        // this.log(
        //   `Carousel: isIntersecting=${
        //     entry.isIntersecting
        //   } target=${target} ratio=${ratio.toFixed(5)}`
        // );

        if (entry.isIntersecting && Math.abs(ratio - 1) < 0.1) {
          entry.target.classList.remove("sideline");
          entry.target.classList.remove("middle");
          // this.log(`Carousel: ${target} -> full`);
        } else if (entry.isIntersecting && Math.abs(ratio - 0.5) < 0.1) {
          entry.target.classList.remove("sideline");
          entry.target.classList.add("middle");
          // this.log(`Carousel: ${target} -> middle`);
        } else {
          entry.target.classList.remove("middle");
          entry.target.classList.add("sideline");
          // this.log(`Carousel: ${target} -> sideline`);
        }
      });
    };

    if (!verticalMode) {
      this.carouselObserver = new IntersectionObserver(
        intersectionCallback,
        options
      );
    }

    // Left padding div.
    if (!verticalMode) {
      let padding = document.createElement("div");
      padding.classList.add("padding");
      this.carouselObserver.observe(padding);
      this.carousel.appendChild(padding);
    }

    // Add screenshots for all windows except the homescreen.
    let readyPromises = new Array();

    let index = 0;
    let selectedIndex = -1;
    let frame = this.windows.firstElementChild;
    while (frame) {
      if (frame.config.isHomescreen) {
        frame = frame.nextElementSibling;
        continue;
      }

      let screenshot = document.createElement("div");
      if (!verticalMode) {
        screenshot.classList.add("sideline");
      }
      let id = frame.getAttribute("id");

      if (id == this.activeFrame) {
        selectedIndex = index;
      }

      let promise = new Promise((resolve) => {
        frame.updateScreenshot().then((blob) => {
          if (blob) {
            if (screenshot.blobUrl) {
              URL.revokeObjectURL(screenshot.blobUrl);
            }
            screenshot.blobUrl = URL.createObjectURL(blob);
            screenshot.style.backgroundImage = `url(${screenshot.blobUrl})`;
          }
          screenshot.classList.add("show");
          resolve();
        });
      });

      readyPromises.push(promise);

      screenshot.setAttribute("frame", id);
      screenshot.setAttribute("id", `carousel-screenshot-${index}`);
      if (frame.state.privatebrowsing) {
        screenshot.classList.add("privatebrowsing");
      }
      index += 1;
      screenshot.classList.add("screenshot");
      screenshot.innerHTML = `
      <div class="head">
        <img class="favicon" src="${frame.state.icon || window.config.brandLogo
        }" />
        <div class="flex-fill"></div>
        <footer>
          <div class="close-icon">
            <sl-icon name="x"></sl-icon>
          </div>
          <div class="audio-play">
            <sl-icon name="volume-1"></sl-icon>
          </div>
        </footer>
      </div>`;
      let audioPlay = screenshot.querySelector(".audio-play");
      if (frame.isPlayingAudio) {
        let audioIcon = audioPlay.firstElementChild;
        audioIcon.setAttribute(
          "name",
          frame.audioMuted ? "volume-x" : "volume-1"
        );
        let playingFrame = frame;
        audioPlay.onclick = (event) => {
          event.stopPropagation();
          // Toggle the muted state.
          let muted = playingFrame.toggleMutedState();
          audioIcon.setAttribute("name", muted ? "volume-x" : "volume-1");
        };
      } else {
        audioPlay.remove();
      }
      screenshot.querySelector(".close-icon").addEventListener(
        "click",
        (event) => {
          this.log(`Will close frame ${id}`);
          event.stopPropagation();
          screenshot.classList.add("closing");
          screenshot.ontransitionend = screenshot.ontransitioncancel = () => {
            screenshot.remove();
            this.closeFrame(id);
            let frameCount = Object.keys(this.frames).length;
            if (!verticalMode) {
              // Update the grid columns definitions.
              if (frameCount > 0) {
                this.carousel.style.gridTemplateColumns = `${marginPercent}% repeat(${frameCount}, ${screenshotPercent}%) ${marginPercent}%`;
              }
            } else {
              updateCarouselAttr(frameCount);
            }

            // Exit the carousel when closing the last window.
            if (frameCount == 0) {
              actionsDispatcher.dispatch("close-carousel");
            }
          };
        },
        { once: true }
      );
      screenshot.addEventListener(
        "click",
        () => {
          this.log(`Will switch to frame ${id}`);
          actionsDispatcher.dispatch("close-carousel");
          this.switchToFrame(id);
          this.forceFrameStateUpdate(id);
        },
        { once: true }
      );
      if (!verticalMode) {
        this.carouselObserver.observe(screenshot);
      }
      this.carousel.appendChild(screenshot);

      frame = frame.nextElementSibling;
    }

    // Create an empty frame with the [+] used as a discoverable way to
    // open a new frame.
    let screenshot = document.createElement("div");
    screenshot.classList.add("screenshot", "show", "new-tab");
    if (!verticalMode) {
      screenshot.classList.add("sideline");
    }
    screenshot.setAttribute("frame", "<new-tab>");
    screenshot.innerHTML = `
      <div class="head">
        <div class="flex-fill"></div>
        <sl-icon name="plus-circle"></sl-icon>
        <div class="flex-fill"></div>
      </div>`;
    screenshot.addEventListener(
      "click",
      () => {
        actionsDispatcher.dispatch("close-carousel");
        // TODO: figure out why we need this setTimeout
        window.setTimeout(() => {
          actionsDispatcher.dispatch("new-tab");
        }, 250);
      },
      { once: true }
    );
    if (!verticalMode) {
      this.carouselObserver.observe(screenshot);
    }
    this.carousel.appendChild(screenshot);

    // Right padding div.
    if (!verticalMode) {
      let padding = document.createElement("div");
      padding.classList.add("padding");
      this.carouselObserver.observe(padding);
      this.carousel.appendChild(padding);
    }

    // Select the current frame, unless we come from the homescreen,
    // in which case we select the first frame.
    if (selectedIndex == -1) {
      selectedIndex = 0;
    }

    let selectedFrame = this.carousel.querySelector(
      `#carousel-screenshot-${selectedIndex}`
    );
    if (!selectedFrame) {
      // When only the "new frame" screenshot is available, select it.
      selectedFrame = this.carousel.querySelector(`div.screenshot`);
    }
    selectedFrame.classList.remove("sideline");
    selectedFrame.scrollIntoView({
      behavior: "instant",
      block: "end",
      inline: "center",
    });

    await Promise.all(readyPromises);

    // Hide the live content and show the carousel.
    this.windows.classList.add("hidden");
    this.carousel.classList.remove("hidden");

    this.isCarouselOpen = true;
    this.keys.changeCarouselState(true);
  }

  closeCarousel() {
    if (!this.isCarouselOpen) {
      return;
    }

    this.keys.changeCarouselState(false);

    // Revoke the blob urls used for the background images.
    let screenshots = this.carousel.querySelectorAll(".screenshot");
    screenshots.forEach((item) => {
      // this.log(`Will revoke blob url ${item.blobUrl}`);
      URL.revokeObjectURL(item.blobUrl);
    });

    // Stop observing the screenshots.
    if (this.carouselObserver) {
      this.carouselObserver.takeRecords().forEach((entry) => {
        this.carouselObserver.unobserve(entry.target);
      });
      this.carouselObserver = null;
    }

    // Empty the carousel.
    this.carousel.innerHTML = "";

    // Display the live content and hide the carousel.
    this.windows.classList.remove("hidden");
    this.carousel.classList.add("hidden");
    this.isCarouselOpen = false;

    // Ensure proper frame visibility after closing carousel
    this.ensureActiveFrameVisibility();
  }

  // Ensure only the active frame is visible to prevent overlapping
  ensureActiveFrameVisibility() {
    for (let frameId in this.frames) {
      let frame = this.frames[frameId];
      if (frameId === this.activeFrame) {
        frame.classList.add("active");
        frame.style.zIndex = "10";
        frame.style.opacity = "1";
        frame.style.pointerEvents = "auto";
      } else if (!frame.classList.contains("split")) {
        frame.classList.remove("active");
        frame.style.zIndex = "1";
        frame.style.opacity = "0";
        frame.style.pointerEvents = "none";
      }
    }
  }

  lockSwipe() {
    this.log(`lockSwipe()`);
    this.classList.add("lock-swipe");
  }

  unlockSwipe() {
    this.log(`unlockSwipe()`);
    this.classList.remove("lock-swipe");
  }
}

customElements.define("window-manager", WindowManager);
