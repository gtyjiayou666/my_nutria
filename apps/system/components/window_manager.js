// <window-manager> custom element: a simple window manager.

// Manages key binding state for the window manager.
const kCarouselModifier =
  embedder.sessionType == "session" ? "Alt" : window.config.metaOrControl;

import CNdata from './chinese.js';

class WindowManagerKeys {
  constructor(wm) {
    this.wm = wm;
    this.isCarouselOpen = false;

    this.isModifierDown = false;
    this.isShiftDown = false;
    this.isShift = false;
    this.isCtrlDown = false;
    this.isAltDown = false;
    this.index = -1;
    this.CANDIDATES_PER_PAGE = 7;
    this.inputText = "";           // 输入区内容（如拼音）
    this.candidateList = [];       // 候选词列表
    this.candidatePinList = [];       // 候选词列表
    this.highlightedIndex = 0;     // 当前高亮候选词索引
    this.inputIndex = 0;           // 高亮候选词索引
    this.committedText = "";
    this.currentPage = 0;
    this.visibleCandidatesLength = 0;
    this.createCandidateUI();

    embedder.addSystemEventListener("keydown", this, true);
    embedder.addSystemEventListener("keyup", this, true);
    document.addEventListener('click', () => {
      this.clearInputText();
    });
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

    if (event.key === kCarouselModifier) {
      this.isModifierDown = event.type === "keydown";

      // Switch to current frame when releasing the [modifier] key.
      if (!this.isModifierDown) {
        this.switchToCurrentFrame();
      }
    }

    if (event.key === "Shift") {
      this.isShiftDown = event.type === "keydown";
      if (event.type === "keyup")
        this.isShift = !this.isShift;
    }

    if (event.key === "Alt") {
      this.isAltDown = event.type === "keydown";
    }

    if (event.key == window.config.metaOrControl) {
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
      return;
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
      return;
    }

    // Close the carousel with [Escape]
    if (
      event.type === "keyup" &&
      event.key === "Escape" &&
      this.isCarouselOpen
    ) {
      actionsDispatcher.dispatch("close-carousel");
      return;
    }

    // 在桌面模式下，支持左右箭头键进行水平滚动
    if (this.isCarouselOpen && event.type === "keydown" && this.candidateContainer.style.display === 'none') {
      const carousel = document.querySelector('window-manager .carousel');
      if (carousel && !carousel.classList.contains('vertical')) {
        if (event.key === "ArrowLeft" && !this.isAltDown) {
          event.preventDefault();
          // 使用更大的滚动量，提供更好的体验
          requestAnimationFrame(() => {
            carousel.scrollBy({
              left: -carousel.clientWidth * 0.4,
              behavior: 'smooth'
            });
          });
        } else if (event.key === "ArrowRight" && !this.isAltDown) {
          event.preventDefault();
          requestAnimationFrame(() => {
            carousel.scrollBy({
              left: carousel.clientWidth * 0.4,
              behavior: 'smooth'
            });
          });
        }
      }
    }

    // Switch to the current frame with [Enter]
    if (event.type === "keyup" && event.key === "Enter") {
      this.switchToCurrentFrame();
      return;
    }

    // Switch to the homescreen frame with [Home]
    if (event.type === "keyup" && event.key === "Home") {
      this.wm.goHome();
      return;
    }

    // Open the url editor with [Ctrl] + [l]
    if (this.isCtrlDown && event.type === "keydown" && event.key === "l") {
      let frame = this.wm.currentFrame();
      if (!frame?.config.isHomescreen) {
        actionsDispatcher.dispatch("open-url-editor", frame.state.url);
      }
      return;
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
      return;
    }

    // Do a WebRender Capture with [Ctrl] + [Shift] + [w]
    if (this.isCtrlDown && this.isShiftDown && event.key === "w") {
      embedder.wrCapture();
      return;
    }

    // Close the current tab with [Ctrl] + [w]
    if (
      this.isCtrlDown &&
      event.type === "keydown" &&
      event.key === "w" &&
      !this.isCarouselOpen
    ) {
      this.wm.closeFrame();
      return;
    }

    // Reload the current tab with [Ctrl] + [r]
    // Zoom in the current tab with [Ctrl] + [+] and [Ctrl] + [=]
    // Zoom out the current tab with [Ctrl] + [-]
    // Reset zoom for the current tab with [Ctrl] + [0]
    if (this.isCtrlDown && event.type === "keydown" && !this.isCarouselOpen) {
      if (event.key === "r") {
        this.wm.reloadCurrentFrame(this.isShiftDown);
        return;
      } else if (event.key === "+") {
        this.wm.zoomInCurrentFrame();
        return;
      } else if (event.key === "=") {
        this.wm.zoomInCurrentFrame();
        return;
      } else if (event.key === "-") {
        this.wm.zoomOutCurrentFrame();
        return;
      } else if (event.key === "0") {
        this.wm.zoomResetCurrentFrame();
        return;
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
      return;
    }
    if (this.isCtrlDown) {
      return;
    }
    if (this.isShift && event.type === "keydown") {
      switch (event.key) {
        case "CapsLock":
        case "Shift":
        case "Alt":
        case "Tab":
        case "NumLock":
          return;
        case "Backspace":
          if (this.candidateContainer.style.display !== 'none') {
            event.preventDefault();
            this.inputText = this.inputText.slice(0, -1);
            if (this.inputText.length != 0) {
              navigator.b2g.inputMethod.setComposition(this.inputText, 0, this.inputText.length);
              this.reInputText(this.inputText);
              this.updateCandidateUI(this.inputText, this.candidateList, this.highlightedIndex);
            } else {
              navigator.b2g.inputMethod.endComposition("");
              this.clearInputText();
            }
          }
          return;
        case 'ArrowUp':
          if (this.candidateContainer.style.display !== 'none') {
            event.preventDefault();
            this.highlightedIndex = this.highlightedIndex - 1;
            if (this.highlightedIndex < 0 && this.currentPage > 0) {
              this.prevCandidatePage();
              this.highlightedIndex = 6;
              this.updateCandidateUI(this.inputText, this.candidateList, this.highlightedIndex);
            }
            if (this.highlightedIndex >= 0) {
              this.updateCandidateUI(this.inputText, this.candidateList, this.highlightedIndex);
            }
          }
          return;
        case 'ArrowDown':
          if (this.candidateContainer.style.display !== 'none') {
            event.preventDefault();
            this.highlightedIndex = this.highlightedIndex + 1;
            if (this.highlightedIndex >= this.visibleCandidatesLength) {
              this.nextCandidatePage();
            }
            this.updateCandidateUI(this.inputText, this.candidateList, this.highlightedIndex);
          }
          return;
        case 'ArrowRight':
          if (this.candidateContainer.style.display !== 'none') {
            event.preventDefault();
            this.nextCandidatePage();
          }
          return;
        case 'ArrowLeft':
          if (this.candidateContainer.style.display !== 'none') {
            event.preventDefault();
            this.prevCandidatePage();
          }
          return;
        case "Enter":
          navigator.b2g.inputMethod.endComposition(this.inputText);
          this.inputText = "";
          event.preventDefault();
          this.clearInputText();
          return;
        case " ":
          if (this.candidateContainer.style.display !== 'none') {
            let index = this.currentPage * this.CANDIDATES_PER_PAGE + this.highlightedIndex;
            this.commitText(index);
            event.preventDefault();
          }
          return;
      }
      // 处理字母：用于输入拼音
      if ((event.key >= 'a' && event.key <= 'z') || (event.key >= 'A' && event.key <= 'Z')) {
        event.preventDefault();
        this.inputText = this.inputText + event.key;
        navigator.b2g.inputMethod.setComposition(this.inputText, 0, this.inputText.length);
        this.reInputText(this.inputText);
        this.updateCandidateUI(this.inputText, this.candidateList, this.highlightedIndex);
        return; // 处理完立即返回
      } else if (event.key >= '0' && event.key <= '9') {
        if (this.candidateContainer.style.display === 'inline-block') {
          event.preventDefault();
          if (event.key >= '1' && event.key <= '7') {
            let index = this.currentPage * this.CANDIDATES_PER_PAGE + Number(event.key) - 1;
            if (index >= this.candidateList.length) {
              return;
            }
            this.commitText(index);
          }
        }
      }
    }
  }

  reInputText(text) {
    this.inputText = text
    let i = 0
    this.candidateList = [];
    this.candidatePinList = [];
    while (this.inputText.length - i > this.inputIndex) {
      const newList = CNdata[this.inputText.slice(this.inputIndex, this.inputText.length - i)] || [];
      this.candidateList = [...this.candidateList, ...newList];
      if (newList.length != 0) {
        const pinyinlist = Array(newList.length).fill(this.inputText.slice(this.inputIndex, this.inputText.length - i));
        this.candidatePinList = [...this.candidatePinList, ...pinyinlist]
      }
      i = i + 1;
    }
  }


  updateInputText(newText) {
    this.inputText = newText;
    if (this.currentLayout._name == "zh-CN") {
      if (this.candidateList.length == 0) {
        this.candidateList = [this.inputText.slice(0, 1)];
        this.candidatePinList = this.candidateList;
      }
      this.showCandidates(this.candidateList);
    } else {
      this.showCandidates([this.inputText]);
    }
  }

  createCandidateUI() {
    this.candidateContainer = document.createElement('div');
    this.candidateContainer.id = 'ime-candidate-container';
    this.candidateContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      background-color: #333;
      color: white;
      border: 1px solid #555;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      padding: 4px;
      font-family: sans-serif;
      font-size: 14px;
      z-index: 9999; /* 确保在最顶层 */
      display: none; /* 初始隐藏 */
      min-width: 200px;
      max-width: 400px;
    `;

    // 创建拼音显示行
    this.pinyinDisplay = document.createElement('div');
    this.pinyinDisplay.id = 'ime-pinyin-display';
    this.pinyinDisplay.style.cssText = `
      padding: 2px 4px;
      margin-bottom: 2px;
      font-style: italic;
      color: #ccc;
    `;
    this.candidateContainer.appendChild(this.pinyinDisplay);

    // 创建候选词列表容器
    this.candidateListElement = document.createElement('div');
    this.candidateListElement.id = 'ime-candidate-list';
    this.candidateListElement.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    `;
    this.candidateContainer.appendChild(this.candidateListElement);

    // 将容器添加到 document.body
    document.body.appendChild(this.candidateContainer);
  }

  updateCandidateUI(inputText, candidates, highlightedIndex) {

    // 当前页码（可以从 this.currentPage 存取，初始化为 0）
    const currentPage = this.currentPage || 0;
    const totalPages = Math.max(1, Math.ceil(candidates.length / this.CANDIDATES_PER_PAGE));
    const pageIndex = Math.min(currentPage, totalPages - 1);

    const start = pageIndex * this.CANDIDATES_PER_PAGE;
    const end = start + this.CANDIDATES_PER_PAGE;
    const visibleCandidates = candidates.slice(start, end);
    this.visibleCandidatesLength = visibleCandidates.length;

    // 更新拼音显示
    this.pinyinDisplay.textContent = inputText || "";

    // 清空现有候选词
    this.candidateListElement.innerHTML = "";

    // 如果没有候选词但有输入，显示输入文本
    if (visibleCandidates.length === 0 && inputText) {
      const item = document.createElement('div');
      item.textContent = inputText;
      item.style.cssText = `
      padding: 2px 6px;
      background-color: #555;
      border-radius: 3px;
      cursor: pointer;
    `;
      this.candidateListElement.appendChild(item);
    } else if (visibleCandidates.length > 0) {
      // 添加当前页的候选词
      visibleCandidates.forEach((candidate, idx) => {
        const globalIndex = idx;
        const item = document.createElement('div');
        item.textContent = `${globalIndex + 1}.${candidate}`;
        item.style.cssText = `
        padding: 2px 6px;
        border-radius: 3px;
        cursor: pointer;
        ${globalIndex === highlightedIndex ?
            'background-color: #0078d7; color: white;' :
            'background-color: transparent; color: white;'}
      `;
        this.candidateListElement.appendChild(item);
      });

      // 可选：添加“下一页”提示（如果还有更多）
      if (pageIndex < totalPages - 1) {
        const moreItem = document.createElement('div');
        moreItem.textContent = '...';
        moreItem.style.cssText = 'color: #aaa; font-size: 12px; text-align: center;';
        this.candidateListElement.appendChild(moreItem);
      }
    }

    // 显示或隐藏容器
    if ((inputText && inputText.length > 0) || candidates.length > 0) {
      this.candidateContainer.style.display = 'inline-block';
      this.positionCandidateUI();
    } else {
      this.clearInputText();
    }
  }
  // 下一页
  nextCandidatePage() {
    this.highlightedIndex = 0;
    const total = this.candidateList.length; // 假设你保存了所有候选词列表
    const totalPages = Math.max(1, Math.ceil(total / this.CANDIDATES_PER_PAGE));
    const currentPage = this.currentPage || 0;

    if (currentPage < totalPages - 1) {
      this.currentPage = currentPage + 1;
      this.updateCandidateUI(this.currentInputText, this.candidateList, this.highlightedIndex);
    }
  }

  // 上一页
  prevCandidatePage() {
    this.highlightedIndex = 0;
    const currentPage = this.currentPage || 0;
    if (currentPage > 0) {
      this.currentPage = currentPage - 1;
      this.updateCandidateUI(this.currentInputText, this.candidateList, this.highlightedIndex);
    }
  }

  onInputChanged() {
    this.currentInputText = this.inputText;
    this.currentPage = 0;
    this.highlightedIndex = 0;
    this.updateCandidateUI(this.currentInputText, this.candidateList, this.highlightedIndex);
  }

  commitText(index) {
    const text = this.candidateList[index];
    const pinyin = this.candidatePinList[index];
    console.info(this.candidatePinList)
    // this.committedText = this.committedText + text;
    console.info(index, text, pinyin, this.committedText)
    navigator.b2g.inputMethod.endComposition(text)
    if (pinyin === this.inputText) {
      // navigator.b2g.inputMethod.setComposition(text, 0, text.length)
      this.clearInputText();
    } else {
      this.reInputText(this.inputText.slice(pinyin.length, this.inputText.length));
      navigator.b2g.inputMethod.setComposition(this.inputText, 0, this.inputText.length)
      this.onInputChanged();
    }
  }

  hideCandidates() {
    this.candidateList = [];
    this.candidatePinList = [];
    this.committedText = "";
  }

  clearInputText() {
    this.hideCandidateUI();
    this.hideCandidates();
    this.inputText = "";
    this.highlightedIndex = 0;
    this.inputIndex = 0;
  }
  positionCandidateUI() {
    const margin = 20; // 距离右下角的边距

    // 先让容器根据内容自适应大小
    Object.assign(this.candidateContainer.style, {
      position: 'absolute',     // 或 'fixed'（如果希望随页面滚动）
      right: `${margin}px`,
      bottom: `${margin}px`,
      top: 'auto',
      left: 'auto',

      width: 'auto',
      maxWidth: '80%',
      whiteSpace: 'nowrap',

      padding: '8px 12px',
      borderRadius: '4px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      fontSize: '14px',
      zIndex: '9999',

      display: 'inline-block'  // 关键：根据内容自适应宽度
    });
  }

  hideCandidateUI() {
    this.candidateContainer.style.display = 'none';
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

    this.isDesktop = embedder.sessionType !== "mobile";

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

    // 为桌面模式添加鼠标滚轮水平滚动支持
    this.carousel.addEventListener('wheel', (event) => {
      // 仅在桌面模式且carousel打开时处理
      if (this.isCarouselOpen && !this.carousel.classList.contains('vertical')) {
        event.preventDefault();

        // 检测滚动方向和强度
        let deltaX = event.deltaX;
        let deltaY = event.deltaY;

        // 如果主要是垂直滚动，转换为水平滚动
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          deltaX = deltaY;
        }

        // 滚动灵敏度
        const scrollMultiplier = 3;
        const scrollAmount = deltaX * scrollMultiplier;

        // 使用requestAnimationFrame确保流畅性
        requestAnimationFrame(() => {
          this.carousel.scrollBy({
            left: scrollAmount,
            behavior: 'auto' // 使用auto而不是smooth，更即时响应
          });
        });
      }
    }, { passive: false });

    // 添加触摸滑动支持（如果是触摸设备）
    let touchStartX = 0;
    let touchStartY = 0;
    let isHorizontalSwipe = false;

    this.carousel.addEventListener('touchstart', (event) => {
      if (this.isCarouselOpen && !this.carousel.classList.contains('vertical')) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        isHorizontalSwipe = false;
      }
    }, { passive: true });

    this.carousel.addEventListener('touchmove', (event) => {
      if (this.isCarouselOpen && !this.carousel.classList.contains('vertical')) {
        const touchX = event.touches[0].clientX;
        const touchY = event.touches[0].clientY;
        const deltaX = touchX - touchStartX;
        const deltaY = touchY - touchStartY;

        // 判断是否为水平滑动
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
          isHorizontalSwipe = true;
          event.preventDefault();
        }
      }
    }, { passive: false });

    this.carousel.addEventListener('touchend', (event) => {
      if (this.isCarouselOpen && !this.carousel.classList.contains('vertical') && isHorizontalSwipe) {
        const touchX = event.changedTouches[0].clientX;
        const deltaX = touchX - touchStartX;

        if (Math.abs(deltaX) > 50) { // 最小滑动距离
          const scrollAmount = deltaX * -2; // 反向滚动
          this.carousel.scrollBy({
            left: scrollAmount,
            behavior: 'smooth'
          });
        }
      }
    }, { passive: true });

    // 添加点击空白处回到主页的功能
    this.carousel.addEventListener('click', (event) => {
      if (this.isCarouselOpen) {
        // 检查点击的目标
        const clickedElement = event.target;

        // 如果点击的是carousel本身，或者是padding区域，则回到主页
        if (clickedElement === this.carousel ||
          clickedElement.classList.contains('padding') ||
          (clickedElement.closest && !clickedElement.closest('.screenshot, .new-tab'))) {

          // 防止点击应用截图或新建标签时触发
          if (!clickedElement.closest('.screenshot') && !clickedElement.closest('.new-tab')) {
            // 点击空白处，关闭carousel并回到主页
            actionsDispatcher.dispatch("close-carousel");
            // 延迟一下再跳转到主页，确保carousel关闭动画完成
            setTimeout(() => {
              this.goHome();
            }, 100);
          }
        }
      }
    });

    // 添加Escape键关闭carousel并回到主页
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isCarouselOpen) {
        actionsDispatcher.dispatch("close-carousel");
        setTimeout(() => {
          this.goHome();
        }, 100);
      }
    });

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
    actionsDispatcher.addListener("go-back", this.goBack.bind(this));
    actionsDispatcher.addListener("android-back", this.androidBack.bind(this));
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

    actionsDispatcher.addListener("desktop-mode-changed", (_name, data) => {
      this.isDesktop = data.isDesktop;
      const homescreenFrame = this.homescreenFrame();
      if (homescreenFrame && homescreenFrame.webView) {
        let currentSrc = homescreenFrame.webView.src;
        const url = new URL(currentSrc);
        const messageData = {
          action: "desktop-mode-changed",
          isDesktop: data.isDesktop,
        };
        const newHash = encodeURIComponent(JSON.stringify(messageData));
        url.hash = newHash;

        const newSrc = url.toString();

        if (newSrc !== currentSrc) {
          homescreenFrame.webView.setAttribute('src', newSrc);
        } else {
          console.log("Hash is already up-to-date.");
        }
      }
      if (this.isCarouselOpen) {
        console.log("WindowManager: Refreshing carousel layout for mode change");
        this.closeCarousel();
        setTimeout(() => {
          this.openCarousel();
        }, 100);
      }
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

    // 触发frame打开事件，让status_bar能立即响应
    this.dispatchEvent(new CustomEvent('frameopen', {
      detail: { id: attrId, url, config }
    }));

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

  // Android风格的返回：优先退出应用而不是页面后退
  androidBack() {
    if (!this.activeFrame) {
      this.log('androidBack: No active frame');
      return;
    }

    const currentFrame = this.frames[this.activeFrame];
    if (!currentFrame) {
      this.log('androidBack: No current frame found');
      return;
    }

    // 如果当前是主屏幕，执行页面后退
    if (currentFrame.config.isHomescreen) {
      this.log('androidBack: On homescreen, performing page back');
      currentFrame.goBack();
      return;
    }

    // 如果是应用窗口，直接关闭应用返回主屏幕（Android风格）
    this.log(`androidBack: Closing app frame ${this.activeFrame} and returning to homescreen`);
    this.closeFrame(this.activeFrame);
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
      // 更严格的过滤条件
      if (!frame.config.isHomescreen && this.shouldShowFrameInTaskbar(frame)) {
        const { title, icon, url } = frame.state;
        let id = frame.getAttribute("id");
        list.push({
          id,
          title,
          icon,
          url,
          manifest: frame.config.manifest,
          isPlayingAudio: frame.isPlayingAudio,
          audioMuted: frame.audioMuted,
        });
      }
      frame = frame.nextElementSibling;
    }

    actionsDispatcher.dispatch("update-frame-list", list);
  }

  // 新增方法：判断frame是否应该在任务栏中显示
  shouldShowFrameInTaskbar(frame) {
    if (!frame || !frame.state) {
      return false;
    }

    const url = frame.state.url;
    const title = frame.state.title;


    // 排除homescreen
    if (url && (
      url.includes('/homescreen/') ||
      url.includes('homescreen/index.html') ||
      url.endsWith('/homescreen') ||
      url.includes('/apps/homescreen/') ||
      title === 'Homescreen' ||
      title === '主屏幕' ||
      title === 'Home Screen'
    )) {
      return false;
    }

    // 排除系统应用
    if (url && (
      url.includes('/system/') ||
      url.includes('system/index.html') ||
      url.includes('/apps/system/')
    )) {
      return false;
    }

    // 排除about页面
    if (url && url.startsWith('about:')) {
      return false;
    }

    // 排除空白页面
    if (!url || url === '' || url === 'about:blank') {
      return false;
    }

    // 排除本地文件系统页面（除非是真实的应用）
    if (url && url.startsWith('file://') && !frame.config.manifest) {
      return false;
    }

    return true;
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

    // 触发frame激活事件，让status_bar能立即响应
    this.dispatchEvent(new CustomEvent('frameactivate', {
      detail: { id, behavior }
    }));
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

    if (!this.isDesktop) {
      this.carousel.classList.add("vertical");
      updateCarouselAttr(frameCount);
      // 清理桌面模式的内联样式
      this.carousel.style.gridTemplateColumns = "";
    } else {
      this.carousel.style.gridTemplateColumns = `${marginPercent}% repeat(${frameCount}, ${screenshotPercent}%) ${marginPercent}%`;
      this.carousel.classList.remove("vertical");
      // 清理垂直模式的类，确保样式重置
      this.carousel.classList.remove("single-row", "two-rows", "single-column");
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

    if (this.isDesktop) {
      this.carouselObserver = new IntersectionObserver(
        intersectionCallback,
        options
      );
    }

    // Left padding div.
    if (this.isDesktop) {
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
      if (this.isDesktop) {
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
            if (this.isDesktop) {
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
      if (this.isDesktop) {
        this.carouselObserver.observe(screenshot);
      }
      this.carousel.appendChild(screenshot);

      frame = frame.nextElementSibling;
    }

    // Create an empty frame with the [+] used as a discoverable way to
    // open a new frame.
    let screenshot = document.createElement("div");
    screenshot.classList.add("screenshot", "show", "new-tab");
    if (this.isDesktop) {
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
    if (this.isDesktop) {
      this.carouselObserver.observe(screenshot);
    }
    this.carousel.appendChild(screenshot);

    // Right padding div.
    if (this.isDesktop) {
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
