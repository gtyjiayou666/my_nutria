# Homescreen 响应式布局开发文档

## 项目概述

本文档介绍了对 Nutria 操作系统中 homescreen 应用和 system 应用的改进，主要实现了以下功能：

1. **Homescreen 响应式重排**：窗口大小变化时，所有 app 图标自动重新排序
2. **多格 Widget 支持**：支持 2x2、2x1 等多格 widget，避免重叠
3. **Quick Settings 自定义按钮**：在快速设置中添加可自定义的功能按钮

## 架构设计

### 核心组件

```
apps/homescreen/
├── js/
│   ├── bootstrap.js          # 主引导文件，包含重排逻辑
│   └── actions_store.js      # 数据存储和事件管理
├── components/
│   ├── actions_wall.js       # UI 容器组件
│   └── action_box.js         # 单个 app 图标组件
└── style/
    └── index.css             # 响应式布局样式

apps/system/components/
├── quick_settings.js         # 快速设置组件
└── quick_settings.css        # 快速设置样式
```

### 事件驱动架构

```
窗口 resize → bootstrap.js → rearrangeAllApps()
                    ↓
            actions_store.js → updatePositionFor()
                    ↓
            发出 position-updated 事件
                    ↓
            actions_wall.js → 监听事件 → 更新 UI
```

## 功能实现详解

### 1. 响应式重排系统

#### 核心算法：`rearrangeAllApps`

**文件：** `apps/homescreen/js/bootstrap.js`

```javascript
function rearrangeAllApps(actionsStore, perLine) {
  // 1. 获取所有 app 数据
  const apps = [...actionsStore.all()];
  
  // 2. 按 widget 大小排序（大 widget 优先）
  apps.sort((a, b) => {
    const sizeA = (a.icon.gridWidth || 1) * (a.icon.gridHeight || 1);
    const sizeB = (b.icon.gridWidth || 1) * (b.icon.gridHeight || 1);
    return sizeB - sizeA;
  });
  
  // 3. 初始化网格和占用矩阵
  const grid = [];
  const occupiedMatrix = [];
  
  // 4. 为每个 app 寻找最佳位置
  for (const app of apps) {
    const gridWidth = app.icon.gridWidth || 1;
    const gridHeight = app.icon.gridHeight || 1;
    
    // 寻找合适的位置
    const position = findBestPosition(occupiedMatrix, gridWidth, gridHeight, perLine);
    
    // 标记占用区域
    markOccupied(occupiedMatrix, position.x, position.y, gridWidth, gridHeight);
    
    // 更新 app 位置
    actionsStore.updatePositionFor(app.manifest.b2g_features.name, position.x, position.y);
  }
  
  // 5. 动态调整容器高度
  updateContainerHeight(maxUsedRow);
}
```

#### 位置查找算法

**特点：**
- 以底部为基准（y=0 为底部，向上递增）
- 支持多格 widget（2x2、2x1 等）
- 避免重叠冲突
- 优先填充底部空间

```javascript
function findBestPosition(occupiedMatrix, width, height, perLine) {
  // 从底部开始搜索
  for (let row = 0; row < MAX_ROWS; row++) {
    for (let col = 0; col <= perLine - width; col++) {
      if (canPlaceAt(occupiedMatrix, col, row, width, height, perLine)) {
        return { x: col, y: row };
      }
    }
  }
}
```

#### 坐标系统

```
传统坐标系 (top-based)    →    新坐标系 (bottom-based)
┌─────────────────┐            ┌─────────────────┐
│ y=0 (top)       │            │ y=3             │
│ y=1             │            │ y=2             │
│ y=2             │            │ y=1             │
│ y=3 (bottom)    │            │ y=0 (bottom)    │
└─────────────────┘            └─────────────────┘
```

### 2. 事件通信机制

#### Store 层事件发布

**文件：** `apps/homescreen/js/actions_store.js`

```javascript
updatePositionFor(name, x, y) {
  const action = this.get(name);
  if (action) {
    action.x = x;
    action.y = y;
    
    // 发布位置更新事件
    this.dispatchEvent(new CustomEvent("position-updated", {
      detail: { name, x, y, action }
    }));
  }
}
```

#### UI 层事件监听

**文件：** `apps/homescreen/components/actions_wall.js`

```javascript
connectedCallback() {
  // 监听 position-updated 事件，自动更新对应 action-box 的位置
  this.store.addEventListener("position-updated", (event) => {
    const { name, x, y } = event.detail;
    const actionBox = this.querySelector(`action-box[data-name="${name}"]`);
    if (actionBox) {
      actionBox.position = { x, y };
    }
  });
}
```

### 3. CSS 响应式布局

#### 容器布局

**文件：** `apps/homescreen/style/index.css`

```css
#actions-panel {
  /* 支持纵向滚动 */
  overflow-y: auto;
  height: 100%;
}

#actions-wall {
  /* 块级布局，支持动态高度 */
  display: block;
  position: relative;
  width: 100%;
  min-height: 100%;
}
```

#### 图标定位

**文件：** `apps/homescreen/components/action_box.js`

```javascript
set position(value) {
  this._position = value;
  if (value) {
    // 底部基准定位
    this.style.position = "absolute";
    this.style.left = `${value.x * this.iconSize}px`;
    this.style.bottom = `${value.y * this.iconSize}px`;
  }
}
```

### 4. Quick Settings 自定义按钮

#### 按钮添加

**文件：** `apps/system/components/quick_settings.js`

```html
<section class="switches">
  <!-- 其他按钮 -->
  <sl-icon name="star" id="new-feature-icon"></sl-icon>
  <!-- 其他按钮 -->
</section>
```

#### 事件处理

```javascript
// 构造函数中绑定事件
shadow.querySelector("#new-feature-icon").onclick = () => {
  this.drawer.hide();
  this.handleNewFeatureClick();
};

// 自定义功能处理
handleNewFeatureClick() {
  console.log('新功能按钮被点击了！');
  
  if (window.toaster) {
    window.toaster.show('新功能按钮已点击', 'primary');
  } else {
    alert('新功能按钮已点击');
  }
}
```

#### 样式定义

**文件：** `apps/system/components/quick_settings.css`

```css
#new-feature-icon {
  color: var(--sl-color-neutral-600);
  cursor: pointer;
  font-size: 1.2rem;
  transition: color 0.2s ease;
}

#new-feature-icon:hover {
  color: var(--sl-color-primary-600);
}
```

## 性能优化

### 1. 去抖动处理

```javascript
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    rearrangeAllApps(window.actionsStore, newPerLine);
  }, 150);
});
```

### 2. 增量更新

- 仅在位置确实发生变化时触发 UI 更新
- 使用事件驱动避免全量重渲染
- 批量处理位置更新

### 3. 内存管理

- 及时清理事件监听器
- 避免循环引用
- 合理使用 WeakMap 存储关联数据

## 兼容性考虑

### 1. 浏览器支持

- 支持现代浏览器的 CSS Grid 和 Flexbox
- 使用 Web Components 标准
- CustomEvent API 支持

### 2. 设备适配

- 响应式设计，支持不同屏幕尺寸
- 触摸设备友好的交互设计
- 高分辨率显示屏支持

### 3. 向后兼容

- 保持原有 API 接口不变
- 渐进式增强，不影响现有功能
- 优雅降级处理

## 调试和测试

### 1. 调试信息

```javascript
// 开启调试模式
window.debugHomescreen = true;

// 在控制台查看重排信息
console.log('Apps rearranged:', apps.map(app => ({
  name: app.manifest.b2g_features.name,
  position: { x: app.x, y: app.y },
  size: { width: app.icon.gridWidth, height: app.icon.gridHeight }
})));
```

### 2. 测试用例

```javascript
// 测试重排算法
function testRearrange() {
  const mockApps = [
    { name: 'app1', gridWidth: 1, gridHeight: 1 },
    { name: 'app2', gridWidth: 2, gridHeight: 2 },
    { name: 'app3', gridWidth: 2, gridHeight: 1 }
  ];
  
  rearrangeAllApps(mockStore, 4);
  
  // 验证结果
  assert(mockStore.get('app2').x === 0);
  assert(mockStore.get('app2').y === 0);
}
```

### 3. 性能监控

```javascript
// 监控重排性能
function measureRearrangePerformance() {
  const start = performance.now();
  rearrangeAllApps(actionsStore, perLine);
  const end = performance.now();
  console.log(`Rearrange took ${end - start} milliseconds`);
}
```

## 部署说明

### 1. 文件修改清单

```
修改的文件：
✓ apps/homescreen/js/bootstrap.js
✓ apps/homescreen/js/actions_store.js
✓ apps/homescreen/components/actions_wall.js
✓ apps/homescreen/components/action_box.js
✓ apps/homescreen/style/index.css
✓ apps/system/components/quick_settings.js
✓ apps/system/components/quick_settings.css

新增的功能：
✓ 响应式重排算法
✓ 事件驱动的 UI 更新
✓ 底部基准定位系统
✓ 多格 widget 支持
✓ 自定义快速设置按钮
```

### 2. 依赖检查

- 确保 Shoelace UI 组件库可用
- 验证 Web Components 支持
- 检查 CSS 自定义属性支持

### 3. 配置项

```javascript
// 可配置参数
const CONFIG = {
  // 图标大小
  ICON_SIZE: 80,
  
  // 最大行数
  MAX_ROWS: 20,
  
  // 重排延迟（毫秒）
  REARRANGE_DELAY: 150,
  
  // 调试模式
  DEBUG_MODE: false
};
```

## 未来扩展

### 1. 计划功能

- **拖拽重排**：支持手动拖拽调整图标位置
- **智能分组**：根据使用频率自动分组应用
- **主题切换**：支持多种布局主题
- **性能优化**：虚拟滚动支持大量应用

### 2. API 扩展

```javascript
// 计划中的 API
homescreen.setLayoutMode('grid' | 'list' | 'custom');
homescreen.addLayoutRule(rule);
homescreen.exportLayout();
homescreen.importLayout(config);
```

### 3. 配置界面

计划添加图形化配置界面，支持：
- 布局模式选择
- 图标大小调整
- 网格间距设置
- 自定义主题

## 故障排除

### 常见问题

1. **图标重叠**
   - 检查 `gridWidth` 和 `gridHeight` 属性
   - 验证占用矩阵计算逻辑

2. **位置不更新**
   - 确认事件监听器正确绑定
   - 检查 Store 中的位置数据

3. **性能问题**
   - 调整重排延迟时间
   - 检查是否有内存泄漏

### 调试技巧

```javascript
// 可视化占用矩阵
function visualizeMatrix(matrix, perLine) {
  for (let row = matrix.length - 1; row >= 0; row--) {
    console.log(
      matrix[row].slice(0, perLine).map(cell => cell ? '█' : '░').join('')
    );
  }
}
```

---

## 贡献指南

如需扩展或修改功能，请遵循以下原则：

1. 保持代码风格一致
2. 添加适当的注释和文档
3. 进行充分的测试
4. 考虑性能影响
5. 保持向后兼容

最后更新：2025年7月9日
版本：1.0.0
