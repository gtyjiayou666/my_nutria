// Starts and attach some event listeners to open and close the search panel.
function stringToBoolean(str) {
  try {
    return JSON.parse(str.toLowerCase());
  } catch {
    return false;
  }
}

// 处理搜索框可见性的函数
function handleSearchPanelVisibility(isDesktop) {
  const searchPanel = document.getElementById("search-panel");
  if (searchPanel) {
    if (isDesktop) {
      // 桌面模式：隐藏搜索框
      searchPanel.style.setProperty('display', 'none', 'important');
      searchPanel.style.setProperty('visibility', 'hidden', 'important');
      searchPanel.style.setProperty('opacity', '0', 'important');
      searchPanel.style.setProperty('pointer-events', 'none', 'important');

      // 同时设置搜索框本身不可交互
      const searchBox = document.getElementById("search");
      if (searchBox) {
        searchBox.style.setProperty('display', 'none', 'important');
        searchBox.style.setProperty('pointer-events', 'none', 'important');
        searchBox.disabled = true;
      }
    } else {
      searchPanel.style.setProperty('display', 'flex', 'important');
      searchPanel.style.setProperty('flex-direction', 'column', 'important');
      searchPanel.style.setProperty('visibility', 'visible', 'important');
      searchPanel.style.setProperty('opacity', '1', 'important');
      searchPanel.style.removeProperty('pointer-events');

      // 同时恢复搜索框本身的交互
      const searchBox = document.getElementById("search");
      if (searchBox) {
        searchBox.style.removeProperty('display');
        searchBox.style.removeProperty('pointer-events');
        searchBox.disabled = false;
      }
    }
  } else {
    console.error("HomeScreen: search-panel element not found!");
  }
}

// 防抖函数，避免频繁触发布局更新
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 检查 app 图标是否在可视区域外或超出网格边界
function isAppOutsideViewport(appElement, container, perLine) {
  if (!appElement || !container) return false;

  const appRect = appElement.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  // 基本的视口检测
  const outsideViewport = (
    appRect.right > containerRect.right ||
    appRect.left < containerRect.left ||
    appRect.bottom > containerRect.bottom ||
    appRect.top < containerRect.top
  );

  // 如果有网格信息，也检查是否超出网格边界
  if (perLine && window.actionsStore) {
    const actionId = getActionIdFromElement(appElement);
    if (actionId) {
      const action = window.actionsStore.actions.find(a => a.id === actionId);
      if (action && action.position) {
        const [x] = action.position.split(',').map(n => parseInt(n));
        if (x >= perLine) {
          return true;
        }
      }
    }
  }

  return outsideViewport;
}

// 获取所有 app 图标元素
function getAllAppElements() {
  const actionsWall = document.getElementById('actions-wall');
  if (!actionsWall) return [];

  // 查找所有 action-box 或 action-bookmark 元素
  const appElements = Array.from(actionsWall.querySelectorAll('action-box, action-bookmark'));
  return appElements;
}

// 从 DOM 元素获取对应的 action ID
function getActionIdFromElement(element) {
  // 尝试多种方式获取 action ID
  const id = element.getAttribute('data-id') ||
    element.getAttribute('id') ||
    element.getAttribute('data-action-id');

  // 如果直接属性没有，检查是否有 action 对象
  if (!id && element.action) {
    return element.action.id;
  }

  return id;
}

// 重新排列超出窗口的 app 图标
function rearrangeOutsideApps(actionsStore, newPerLine) {
  const container = document.getElementById('actions-panel');
  const appElements = getAllAppElements();

  if (!container || !actionsStore || appElements.length === 0)
    return;

  // 找出所有超出窗口的 app
  const outsideApps = [];
  appElements.forEach(appElement => {
    if (isAppOutsideViewport(appElement, container, newPerLine)) {
      const appId = getActionIdFromElement(appElement);
      if (appId) {
        outsideApps.push({ element: appElement, id: appId });
      }
    }
  });

  if (outsideApps.length === 0) {
    return;
  }

  // 获取空闲位置
  const emptySlots = actionsStore.getEmptySlots(newPerLine);

  // 将超出窗口的 app 移动到空闲位置
  const emptySlotArray = Array.from(emptySlots);
  outsideApps.forEach((app, index) => {
    if (index < emptySlotArray.length) {
      const newPosition = emptySlotArray[index];
      actionsStore.updatePositionFor(app.id, newPosition);
    }
  });

  // 如果空闲位置不够，重新排列所有 app
  if (outsideApps.length > emptySlotArray.length) {
    rearrangeAllApps(actionsStore, newPerLine);
  }
}

// 获取 widget 的大小信息
function getWidgetSize(action) {
  // 尝试从 DOM 元素获取 widget 大小
  const actionElement = document.getElementById(`action-${action.id}`);
  if (actionElement) {
    if (actionElement.classList.contains('widget-2x2')) {
      return { width: 2, height: 2 };
    } else if (actionElement.classList.contains('widget-2x1')) {
      return { width: 2, height: 1 };
    } else if (actionElement.classList.contains('widget-1x2')) {
      return { width: 1, height: 2 };
    }
  }

  // 尝试从 action.size 属性获取
  if (action.size) {
    if (action.size === '2x2') {
      return { width: 2, height: 2 };
    } else if (action.size === '2x1') {
      return { width: 2, height: 1 };
    } else if (action.size === '1x2') {
      return { width: 1, height: 2 };
    }
  }

  // 默认为 1x1
  return { width: 1, height: 1 };
}

// 检查网格位置是否可以放置指定大小的 widget
function canPlaceWidget(grid, x, y, width, height, perLine, maxRows) {
  // 检查边界
  if (x + width > perLine || y + height > maxRows) {
    return false;
  }

  // 检查所有需要占用的格子是否空闲
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      if (grid[y + dy] && grid[y + dy][x + dx]) {
        return false; // 位置已被占用
      }
    }
  }

  return true;
}

// 在网格中标记 widget 占用的位置
function markGridOccupied(grid, x, y, width, height, actionId) {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      if (!grid[y + dy]) {
        grid[y + dy] = [];
      }
      grid[y + dy][x + dx] = actionId;
    }
  }
}

// 重新排列所有 app 图标（支持多格 widget，以底部为基准）
function rearrangeAllApps(actionsStore, perLine) {
  if (!actionsStore || !actionsStore.actions) return;

  // 按照当前位置排序（保持相对顺序）
  const sortedActions = [...actionsStore.actions].sort((a, b) => {
    const [aX, aY] = a.position.split(',').map(n => parseInt(n));
    const [bX, bY] = b.position.split(',').map(n => parseInt(n));

    // 先按行排序，再按列排序
    if (aY !== bY) return aY - bY;
    return aX - bX;
  });

  // 创建网格来跟踪占用情况
  const grid = [];
  const maxRows = Math.ceil(sortedActions.length * 4 / perLine) + 10; // 预留足够空间

  // 从底部开始逐行填充
  let currentRow = 0; // 从底行开始（y=0代表最底行）
  let currentCol = 0;
  let maxUsedRow = 0; // 记录实际使用的最高行

  // 逐个放置 widget
  sortedActions.forEach((action) => {
    const size = getWidgetSize(action);

    let placed = false;

    // 从当前位置开始寻找合适的位置
    for (let row = currentRow; row < maxRows && !placed; row++) {
      let startCol = (row === currentRow) ? currentCol : 0;

      for (let col = startCol; col <= perLine - size.width && !placed; col++) {
        if (canPlaceWidget(grid, col, row, size.width, size.height, perLine, maxRows)) {
          // 找到合适位置
          const newPosition = `${col},${row}`;
          if (action.position !== newPosition) {
            actionsStore.updatePositionFor(action.id, newPosition);
          }

          // 在网格中标记占用
          markGridOccupied(grid, col, row, size.width, size.height, action.id);
          placed = true;

          // 更新最高使用行
          maxUsedRow = Math.max(maxUsedRow, row + size.height - 1);

          // 更新下一个放置的起始位置
          currentCol = col + size.width;
          if (currentCol >= perLine) {
            currentRow = row + 1;
            currentCol = 0;
          } else {
            currentRow = row;
          }
        }
      }

      // 如果这一行放不下，移动到下一行
      if (!placed && row === currentRow) {
        currentRow = row + 1;
        currentCol = 0;
      }
    }

    if (!placed) {
      console.warn(`无法为 widget ${action.id} (${size.width}x${size.height}) 找到合适位置`);
    }
  });

  // 设置actions-wall的高度以容纳所有图标
  const actionsWall = document.getElementById('actions-wall');
  if (actionsWall) {
    const neededHeight = (maxUsedRow + 1) * parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--action-box-height') || '6em');
    const minHeight = parseFloat(getComputedStyle(actionsWall.parentElement).height);
    actionsWall.style.height = `${Math.max(neededHeight, minHeight)}px`;
  }
}

function updateActionLayout() {
  const root = document.documentElement;
  const container = document.getElementById('actions-panel');
  if (!container) return;

  const containerWidth = container.clientWidth;

  // 尝试从 CSS 变量获取实际的 action box 宽度
  const computedStyle = getComputedStyle(root);
  const actionBoxWidthStr = computedStyle.getPropertyValue('--action-box-width').trim();
  let actionBoxWidth = 80; // 默认值

  if (actionBoxWidthStr) {
    // 如果是 em 单位，需要转换为像素
    if (actionBoxWidthStr.endsWith('em')) {
      const emValue = parseFloat(actionBoxWidthStr);
      const fontSize = parseFloat(computedStyle.fontSize) || 16;
      actionBoxWidth = emValue * fontSize;
    } else if (actionBoxWidthStr.endsWith('px')) {
      actionBoxWidth = parseFloat(actionBoxWidthStr);
    }
  }

  // 添加一些额外的间距来计算每行的数量
  const gapValue = parseFloat(computedStyle.getPropertyValue('gap')) || 10;
  const effectiveWidth = actionBoxWidth + gapValue;

  const newPerLine = Math.max(1, Math.floor(containerWidth / effectiveWidth));
  const currentPerLine = parseInt(computedStyle.getPropertyValue('--action-per-line')) || 4;


  // 更新 CSS 变量
  root.style.setProperty('--action-per-line', newPerLine);

  // 如果每行数量发生变化，重新排列所有 app 图标
  if (newPerLine !== currentPerLine) {
    // 延迟一点时间等待 DOM 更新
    setTimeout(() => {
      // 尝试获取全局的 actionsStore 实例
      if (window.actionsStore) {
        rearrangeAllApps(window.actionsStore, newPerLine);
      } else {
        // 如果 actionsStore 还没有初始化，监听 store-ready 事件
        document.addEventListener('store-ready', () => {
          if (window.actionsStore) {
            rearrangeAllApps(window.actionsStore, newPerLine);
          }
        }, { once: true });
      }
    }, 100);
  }
}

// 使用防抖版本的 updateActionLayout
const debouncedUpdateActionLayout = debounce(updateActionLayout, 250);

window.addEventListener('resize', debouncedUpdateActionLayout);
window.addEventListener('DOMContentLoaded', updateActionLayout);




var graph;

const kBindingsModifier = "Control";
// Global key bindings for the homescreen.
class KeyBindings {
  constructor() {
    this.isModifierDown = false;
    window.addEventListener("keydown", this, true);
    window.addEventListener("keyup", this, true);
  }

  handleEvent(event) {
    if (event.key == kBindingsModifier) {
      this.isModifierDown = event.type === "keydown";
    }

    // [Ctrl]+[l] opens the search box.
    if (this.isModifierDown && event.type === "keydown" && event.key === "l") {
      openSearchBox();
    }
  }
}

function openSearchBox() {
  let searchPanel = document.getElementById("search-panel");
  if (!searchPanel.classList.contains("open")) {
    let searchBox = document.getElementById("search-box");
    searchBox.focus();
  }
}

function isPrivateBrowsing() {
  let elem = document.getElementById("private-browsing");
  return elem.classList.contains("active");
}

// Helper to decide how to process an window.open url parameter.
// Returns true if window.open() was called, false otherwise.
function maybeOpenURL(url, details = {}) {
  console.log(`maybeOpenURL ${url}`);
  if (!url || url.length == 0) {
    return false;
  }

  details.privatebrowsing = isPrivateBrowsing();

  let isUrl = false;
  try {
    let a = new URL(url);
    isUrl = true;
  } catch (e) { }

  if (url.startsWith("about:")) {
    let act = new WebActivity("open-about", { url });
    act.start();
    return true;
  }

  const isFileUrl = url.startsWith("file://");
  console.log(`maybeOpenURL isUrl=${isUrl} isFileUrl=${isFileUrl}`);

  try {
    // No "." in the url that is not a file:// or ipfs:// one, return false since this
    // is likely a keyword search.
    if (!url.includes(".") && !isUrl) {
      return false;
    }

    if (
      !isFileUrl &&
      !url.startsWith("http") &&
      !url.startsWith("ipfs://") &&
      !url.startsWith("ipns://") &&
      !url.startsWith("tile://")
    ) {
      url = `https://${url}`;
    }

    let encoded = encodeURIComponent(JSON.stringify(details));
    window.open(url, "_blank", `details=${encoded}`);
    console.log(`maybeOpenURL called window.open(${url})`);
  } catch (e) {
    console.log(`maybeOpenUrl oops ${e}`);
  }
  return true;
}

let isDesktop = false;
function handleHashChange() {

  const hash = window.location.hash.substring(1);

  if (!hash) {
    console.log("No hash present.");
    return;
  }

  console.log("Hash changed:", hash);

  if (hash === "lock" || hash === "unlock") {
    return;
  }
  try {

    const data = JSON.parse(decodeURIComponent(hash));

    if (!data.action) {
      console.warn("Received hash data without 'action' field:", data);
      return;
    }
    switch (data.action) {
      case "desktop-mode-changed":
        // 触发桌面模式切换事件，让其他组件可以响应
        const actionsWall = document.getElementById('actions-wall');
        actionsWall.changeMode(data.isDesktop);
        handleSearchPanelVisibility(data.isDesktop);
        break;

      default:
        console.warn("Unknown action received via hash:", data.action, data);
    }

  } catch (error) {
    console.error("Failed to parse hash data:", hash, error);
  }
}

window.addEventListener('hashchange', handleHashChange);

document.addEventListener("DOMContentLoaded", async () => {
  await depGraphLoaded;

  graph = new ParallelGraphLoader(addSharedDeps(addShoelaceDeps(kDeps)));
  await Promise.all(
    ["shared-fluent", "main"].map((dep) => graph.waitForDeps(dep))
  );

  const urlParams = new URLSearchParams(window.location.search);
  const isDesktop = urlParams.get('isDesktop');
  const actionsWall = document.getElementById('actions-wall');
  actionsWall.changeMode(stringToBoolean(isDesktop));
  handleSearchPanelVisibility(stringToBoolean(isDesktop));
  let actionsPanel = document.getElementById("actions-panel");
  let searchBox = document.getElementById("search-box");

  let panelManager = null;

  async function ensurePanelManager() {
    // Lazy loading of dependencies for the search panel.
    if (panelManager) {
      return;
    }
    let result = await graph.waitForDeps("search");
    let module = result.get("search panel");
    panelManager = new module.SearchPanel();
    panelManager.init();

  }

  async function openSearchPanel() {
    await ensurePanelManager();
    panelManager.onOpen();
    actionsPanel.classList.add("hide");
  }


  function closeSearchPanel() {
    actionsPanel.classList.remove("hide");
    searchBox.value = "";
    panelManager.onClose();
  }

  searchBox.addEventListener("blur", async () => {
    console.log("SearchBox: blur event triggered");
    closeSearchPanel();
    panelManager.clearAllResults();
  });

  searchBox.addEventListener("focus", async () => {
    openSearchPanel();
  });

  searchBox.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchBox.blur();
    }

    if (event.key === "Tab") {
      document.getElementById("default-search-results").onTabKey(event);
      event.preventDefault();
    }
  });

  let opensearchEngine;
  searchBox.addEventListener("keypress", (event) => {
    opensearchEngine = opensearchEngine || new OpenSearch();
    console.log(`SearchBox: keypress ${event.key}`);
    if (event.key !== "Enter") {
      return;
    }

    if (document.getElementById("default-search-results").onEnterKey()) {
      return;
    }

    let input = searchBox.value.trim();
    searchBox.blur();
    if (!maybeOpenURL(input)) {
      // Keyword search, redirect to the current search engine.
      maybeOpenURL(opensearchEngine.getSearchUrlFor(input), { search: input });
    }
  });

  // Configure activity handlers.
  let activities = new ActivityManager({
    "add-to-home": addToHome,
  });

  // let keyBindings = new KeyBindings();

  document.getElementById("qr-code").onclick = () => {
    let activity = new WebActivity("scan-qr-code");
    activity.start().then(
      (result) => {
        // await ensurePanelManager();
        // check that this is a proper url.
        console.log(`SCAN-QR-CODE: result is ${result}`);
        try {
          // Rewrite ticket: urls to local dweb/$ticket ones.
          if (result.startsWith("ticket:")) {
            result = `http://localhost:${config.port}/dweb/${result.substring(
              7
            )}`;
          }
          let url = new URL(result);
          maybeOpenURL(url.href);
        } catch (e) {
          console.error(`SCAN-QR-CODE: result is not a URL: ${e}`);
          displayQRCodeResult(result);
        }
      },
      (error) => {
        console.error(`SCAN-QR-CODE: failure: ${error}`);
      }
    );
  };

  const HomescreenFns = {
    isAppInHomescreen: (url) => {
      let actionsWall = document.querySelector("actions-wall");
      return Promise.resolve(!!actionsWall.store.getActionByManifestUrl(url));
    },

    newTab: openSearchBox,
  };

  let xac = await import(`http://shared.localhost:${config.port}/xac/peer.js`);
  let peer = new xac.Peer(
    [{ host: "system", fns: ["isAppInHomescreen", "newTab"] }],
    HomescreenFns
  );
  peer.addEventListener("ready", () => {
    console.log(`XAC: Homescreen received ready!`);
  });
});

window.utils = {
  // Helper to localize a single string.
  l10n: async (id, args) => {
    return await document.l10n.formatValue(id, args);
  },
};

async function displayQRCodeResult(text) {
  await graph.waitForDeps("qr dialog comp");
  document.getElementById("qr-dialog").open(text);
}

async function addToHome(data) {
  let actionsWall = document.querySelector("actions-wall");
  if (data.siteInfo) {
    let siteInfo = data.siteInfo;
    for (let prop in siteInfo) {
      console.log(`  ${prop}: ${siteInfo[prop]}`);
    }
    actionsWall.addNewAction({
      kind: "bookmark",
      title: siteInfo.title,
      url: siteInfo.url,
      icon:
        siteInfo.icon ||
        `http://branding.localhost:${location.port}/resources/logo.webp`,
      backgroundColor: siteInfo.backgroundColor,
      color: siteInfo.color,
    });
  } else if (data.app) {
    // We got an app object, for instance for an already installed app that is not pinned to the
    // homescreen.
    actionsWall.addAppAction(data.app);
  }

  return true;
}

