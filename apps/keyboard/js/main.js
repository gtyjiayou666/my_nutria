class KeyboardLayout {


  constructor(root) {
    this.currentLayout = null;
    this.layouts = {};
    this.root = root;

    this.inputPreviewBar = document.getElementById("input-preview-bar");

    this.inputText = "";           // 输入区内容（如拼音）
    this.candidateList = [];       // 候选词列表
    this.candidatePinList = [];       // 候选词列表
    this.highlightedIndex = 0;     // 当前高亮候选词索引
    this.inputIndex = 0;           // 高亮候选词索引
    this.candidateBar = document.getElementById("candidate-bar");
    this.committedText = "";
    this.selectedTextBadge = document.getElementById('selected-text-badge');

    this.selectedTextBadge.textContent = "";
    this.CNdata;

    this.loadData()
    this.root.addEventListener("pointerdown", this, { passive: true });
    this.root.addEventListener("pointerup", this, { passive: true });
    this.root.addEventListener("contextmenu", this, { passive: true });
    let isDown = false;
    let startX;
    let scrollLeft;
    // 如果 pointer 事件不支持，可以用 touch 事件兜底
    this.candidateBar.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      isDown = true;
      startX = touch.pageX - candidateBar.offsetLeft;
      scrollLeft = candidateBar.scrollLeft;
    }, { passive: false });

    this.candidateBar.addEventListener('touchmove', (e) => {
      if (!isDown) return;
      e.preventDefault(); // 关键：允许横向滚动

      const touch = e.touches[0];
      const x = touch.pageX - this.candidateBar.offsetLeft;
      const walk = (x - startX) * 1.5;
      this.candidateBar.scrollLeft = scrollLeft - walk;
    }, { passive: false }); // ⚠️ 必须设置 { passive: false } 才能 preventDefault

    this.candidateBar.addEventListener('touchend', () => {
      isDown = false;
    });
    // 监听滚动事件
    // if (this.inputPreviewBar) {
    //   this.inputPreviewBar.addEventListener('scroll', this.updateScrollIndicators);
    // }

    this.handleHashMessage = this.handleHashMessage.bind(this);


    window.addEventListener("hashchange", this.handleHashMessage);

  }



  updateScrollIndicators() {
    if (!this.inputPreviewBar || !this.candidateBar) return;

    const { scrollLeft, scrollWidth, clientWidth } = this.inputPreviewBar;
    const canScrollRight = scrollLeft < scrollWidth - clientWidth;

    // 通过 class 控制右侧阴影
    this.inputPreviewBar.classList.toggle('no-scroll-right', !canScrollRight);
  }


  async loadData() {
    try {
      const response = await fetch('../resources/chinese.json');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      this.CNdata = JSON.parse(text);

    } catch (error) {
      console.error('错误:', error);
      this.CNdata = {}; // 设置默认值
    }
  }
  // 显示候选词
  showCandidates(words) {
    this.candidateList = words;
    this.highlightedIndex = 0;

    this.candidateBar.innerHTML = "";
    words.forEach((word, index) => {
      const span = document.createElement("span");
      span.className = "candidate-item";
      span.dataset.index = index;
      span.textContent = word;
      let startX = 0;
      let isSwiping = false;

      span.addEventListener("pointerdown", (e) => {
        startX = e.pageX;
        isSwiping = false;

        const bar = this.candidateBar;
        const initialScrollLeft = bar.scrollLeft;

        const onMove = (moveEvent) => {
          const dx = moveEvent.pageX - startX;
          if (!isSwiping && Math.abs(dx) > 10) {
            isSwiping = true;
            moveEvent.preventDefault();
          }

          if (isSwiping) {
            // 手动滚动父容器
            bar.scrollLeft = initialScrollLeft - dx;
          }
        };
        const onUp = () => {
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);

          if (!isSwiping) {
            this.commitText(index);
          }
        };
        document.addEventListener("pointermove", onMove, { passive: false });
        document.addEventListener("pointerup", onUp);
      });
      this.candidateBar.appendChild(span);
    });

    this.updateCandidateHighlight();
    this.candidateBar.style.display = "inline";
  }


  // 更新高亮样式
  updateCandidateHighlight() {
    const items = this.candidateBar.querySelectorAll(".candidate-item");
    items.forEach((item, index) => {
      item.classList.toggle("highlighted", index === this.highlightedIndex);
    });
  }


  // 隐藏候选词
  hideCandidates() {
    this.candidateBar.style.display = "none";
    this.candidateList = [];
    this.candidatePinList = [];
    this.committedText = "";
    this.selectedTextBadge.textContent = "";
  }


  commitText(index) {
    const text = this.candidateList[index];
    const pinyin = this.candidatePinList[index];
    if (this.currentLayout._name == "en-US") {
      this.clearInputText();
    } else if (this.currentLayout._name == "zh-CN") {
      this.committedText = this.committedText + text;
      if (pinyin === this.inputText) {
        navigator.b2g.inputMethod.setComposition(this.committedText, 0, this.committedText.length)
        navigator.b2g.inputMethod.endComposition(this.committedText)
        this.clearInputText();
      } else {
        this.reInputText(this.inputText.slice(pinyin.length, this.inputText.length));
        this.selectedTextBadge.textContent = this.committedText + "'" + this.inputText;
      }
      // this.clearInputText();
    }
  }




  handleHashMessage() {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    this.clearInputText();
  }
  // --- 新增方法：更新输入文本 ---
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



  // 处理空格键
  handleSpaceKey() {
    // 如果有候选词且显示中，选择高亮项
    if (this.candidateList.length > 0 && this.candidateBar.style.display !== "none") {
      this.commitText(this.highlightedIndex);  // 上屏候选词
    } else {
      navigator.b2g.inputMethod.sendKey(" ");
    }
  }


  reInputText(text) {
    this.inputText = text
    let i = 0
    this.candidateList = [];
    this.candidatePinList = [];
    while (this.inputText.length - i > this.inputIndex) {
      const newList = this.CNdata[this.inputText.slice(this.inputIndex, this.inputText.length - i)] || [];
      this.candidateList = [...this.candidateList, ...newList];
      if (newList.length != 0) {
        const pinyinlist = Array(newList.length).fill(this.inputText.slice(this.inputIndex, this.inputText.length - i));
        this.candidatePinList = [...this.candidatePinList, ...pinyinlist]
      }
      i = i + 1;
    }
    this.updateInputText(this.inputText);
  }



  appendToInputText(char) {
    this.inputText = this.inputText + char
    if (this.currentLayout._name == "zh-CN") {
      const newList = this.CNdata[this.inputText.slice(this.inputIndex, this.inputText.length)] || [];
      this.candidateList = [...newList, ...this.candidateList];
      if (newList.length != 0) {
        const pinyinlist = Array(newList.length).fill(this.inputText.slice(this.inputIndex, this.inputText.length));
        this.candidatePinList = [...pinyinlist, ...this.candidatePinList]
      }
    }
    this.updateInputText(this.inputText);
  }

  // --- 新增方法：删除最后一个字符 ---
  backspaceFromInputText() {
    if (this.currentLayout._name == "zh-CN") {
      const newList = this.CNdata[this.inputText.slice(this.inputIndex, this.inputText.length)] || [];
      this.candidateList = this.candidateList.slice(newList.length, this.candidateList.length);
      this.candidatePinList = this.candidatePinList.slice(newList.length, this.candidatePinList.length);
    }
    this.updateInputText(this.inputText.slice(0, -1));
  }

  // --- 新增方法：清空输入文本 ---
  clearInputText() {
    this.hideCandidates();
    this.inputText = "";
    this.highlightedIndex = 0;     // 当前高亮候选词索引
    this.inputIndex = 0;           // 高亮候选词索引
    this.selectedTextBadge.textContent = ""
    this.committedText = ""
    this.candidateBar.innerHTML = "";
  }





  async loadLayout(name) {
    let module = await import(`../layouts/${name}.js`);
    this.layouts[name] = module.keyboardLayout;
    this.layouts[name]._name = name;
  }

  selectLayout(name) {
    if (this.layouts[name]) {
      this.currentLayout = this.layouts[name];
      this.switchToView("standard");
    } else {
      console.error(`Failed to select unavailable layout ${name}`);
    }
  }

  // Return the DOM for a named view as a DocumentFragment.
  buildView(name) {
    let view = this.currentLayout.views[name];
    if (!view) {
      console.error(
        `No '${name} view found in the '${this.currentLayout.description}' layout.`
      );
      return null;
    }

    let fragment = new DocumentFragment();

    view.forEach((line) => {
      let container = document.createElement("div");
      line.split(" ").forEach((keyName) => {
        let elem = document.createElement("span");
        elem.classList.add("keycap");

        // Create an outer container to avoid using a margin around keycap
        // since margins are not getting pointer events.
        let outer = document.createElement("span");
        outer.classList.add("outer");

        let text = keyName;
        let key = keyName;

        // Check if we should use an alternate text or icon from the "keys"
        // section of the layout definition.
        let customization = this.currentLayout.keys[keyName];
        if (customization && customization.display) {
          let display = customization.display;
          if (display.text) {
            text = display.text;
          } else if (display.icon) {
            text = null;
            let icon = document.createElement("lucide-icon");
            icon.setAttribute("kind", display.icon);
            elem.appendChild(icon);
          }

          if (display.style) {
            elem.classList.add(`style-${display.style}`);
          }

          if (display.size) {
            elem.classList.add(`size-${display.size}`);
            outer.classList.add(`size-${display.size}`);
          }

          if (display.key) {
            key = display.key;
          }
        }

        outer.setAttribute("data-key", key);
        outer.appendChild(elem);

        if (customization?.behavior) {
          outer.behavior = customization.behavior;
        }

        if (customization?.nobubble) {
          outer.nobubble = customization.nobubble;
        }

        if (text) {
          elem.textContent = text;
          if (text.length > 2) {
            elem.classList.add("reduce-font-size");
          }
        }

        if (keyName == "Space") {
          elem.textContent = this.currentLayout.description;
          elem.classList.add("layout-description");
        }

        container.appendChild(outer);
      });
      fragment.appendChild(container);
    });

    return fragment;
  }

  switchToView(viewName) {
    let dom = this.buildView(viewName);
    if (dom) {
      while (this.root.firstChild) {
        this.root.removeChild(this.root.firstChild);
      }
      this.root.appendChild(dom);
      this.currentView = viewName;
    }
  }

  processCommand(cmd) {
    if (cmd[0] === "switch-view") {
      this.switchToView(cmd[1]);
    } else if (cmd[0] === "switch-tempview") {
      this.nextView = this.currentView;
      this.switchToView(cmd[1]);
    } else if (cmd[0] === "next-layout") {
      let names = Object.keys(this.layouts);
      let pos = names.indexOf(this.currentLayout._name);
      if (pos == names.length - 1) {
        pos = 0;
      } else {
        pos += 1;
      }
      this.selectLayout(names[pos]);
    }
  }

  showKeyBubble(target, key) {
    let elem = document.createElement("div");
    elem.textContent = key;
    elem.classList.add("bubble");

    // target is the outer div, but we want to align the bubble with the div.keycap one.
    let rect = target.firstElementChild.getBoundingClientRect();
    elem.style.left = `${rect.left}px`;
    elem.style.top = `${rect.top - 60}px`;

    document.body.append(elem);

    window.setTimeout(() => {
      elem.remove();
    }, 200);
  }

  handleEvent(event) {
    // console.log(`Keyboard event is ${event.type}`);

    let target = event.target;
    let key = target.getAttribute("data-key");
    do {
      key = target.getAttribute("data-key");
      if (key) {
        break;
      }
      target = target.parentNode;
    } while (!key && target && target.getAttribute);

    if (!key) {
      console.error(`No key found for ${event.type}`);
      return;
    }

    if (event.type === "pointerdown") {
      target.classList.add("active");
      navigator.vibrate(10);
      this.cancelPointerUp = false;
      if (!((target.behavior && target.behavior.press) || target.nobubble)) {
        this.showKeyBubble(target, key);
      }
    } else if (event.type === "pointerup") {
      target.classList.remove("active");
      if (this.cancelPointerUp) {
        return;
      }
      if (target.behavior && target.behavior.press) {
        this.processCommand(target.behavior.press.split(" "));
      } else {

        if (key == " ") {
          this.handleSpaceKey();
        } else {
          if (this.currentLayout._name == "zh-CN") {

            if (key === "Backspace") {
              if (this.inputText.length == 0) {
                navigator.b2g.inputMethod.sendKey(key);
              } else {
                this.backspaceFromInputText();
                if (this.inputText.length == 0) {
                  navigator.b2g.inputMethod.setComposition(this.committedText, 0, this.committedText.length)
                  navigator.b2g.inputMethod.endComposition(this.committedText)
                  this.clearInputText();
                } else {
                  if (this.committedText.length == 0) {
                    this.selectedTextBadge.textContent = this.inputText;
                  } else {
                    this.selectedTextBadge.textContent = this.committedText + "'" + this.inputText;
                  }
                }
              }
            } else if (key == "Enter") {
              if (this.inputText.length === 0) {
                navigator.b2g.inputMethod.sendKey(key);
              } else {
                this.selectedTextBadge.textContent = this.selectedTextBadge.textContent.replace("'", '');
                navigator.b2g.inputMethod.setComposition(this.selectedTextBadge.textContent, 0, this.selectedTextBadge.textContent.length)
                navigator.b2g.inputMethod.endComposition(this.selectedTextBadge.textContent)
                this.clearInputText();
              }
            } else {
              // 假设 key 就是要输入的字符
              this.appendToInputText(key);
              if (this.committedText.length == 0) {
                this.selectedTextBadge.textContent = this.inputText;
              } else {
                this.selectedTextBadge.textContent = this.committedText + "'" + this.inputText;
              }
              // navigator.b2g.inputMethod.setComposition(this.inputText, this.inputIndex, this.inputText.length)
            }
          } else {
            navigator.b2g.inputMethod.sendKey(key);
            if (!target.behavior) {
              // 特殊处理 Backspace
              if (key === "Backspace") {
                this.backspaceFromInputText();
              } else {
                // 假设 key 就是要输入的字符
                this.appendToInputText(key);
              }
            }
          }
        }

        // If we came to this view by a 'switch-tempview' command,
        // revert to the previous view.
        if (this.nextView) {
          this.switchToView(this.nextView);
          this.nextView = null;
        }
      }
    } else if (event.type === "contextmenu") {
      target.classList.remove("active");
      this.cancelPointerUp = true;
      if (target.behavior && target.behavior.longpress) {
        this.processCommand(target.behavior.longpress.split(" "));
      }
    }
  }
}

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    await depGraphLoaded;
    await getSharedDeps("shared-icons");

    let layout = new KeyboardLayout(document.getElementById("vkb"));

    const layouts = ["en-US", "zh-CN"];

    for (lang of layouts) {
      await layout.loadLayout(lang);
    }
    layout.selectLayout(layouts[1]);

  },
  { once: true }
);
