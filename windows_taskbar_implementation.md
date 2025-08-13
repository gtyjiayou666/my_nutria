/* Windows 任务栏风格状态栏实现说明

## 功能概览
当 isDesktop 为 true 时，状态栏将转换为类似 Windows 的任务栏：

### 桌面模式特性：
1. **开始按钮**：位于左侧，点击打开应用列表
2. **任务栏项目区域**：显示当前打开的应用/标签页
3. **系统托盘**：包含时间、电池等系统信息
4. **Windows 风格设计**：渐变背景、圆角、阴影效果

### 移动模式特性：
保持原有的三段式布局（左-中-右）

## 主要修改

### JavaScript (status_bar.js)
- `updateQuicklaunchPosition()`: 扩展为完整的布局切换逻辑
- `enableDesktopTaskbar()`: 启用桌面任务栏模式
- `disableDesktopTaskbar()`: 禁用桌面任务栏模式
- `createStartButton()`: 创建开始按钮
- `createSystemTray()`: 创建系统托盘
- `reorganizeForDesktop()`: 重新组织桌面布局
- `removeDesktopElements()`: 移除桌面模式元素
- `restoreOriginalLayout()`: 恢复移动布局
- `updateClock()`: 同时更新移动和桌面时钟

### CSS (status_bar.css)
- 新增 CSS 变量定义
- Windows 风格的任务栏样式
- 开始按钮的渐变效果和交互状态
- 任务栏项目的悬停和活动状态
- 系统托盘的半透明效果
- 响应式隐藏/显示逻辑

## 使用方法
1. 桌面模式通过 QuickSettings 的星号按钮切换
2. 自动监听 'desktop-mode-changed' 事件
3. 与现有的 wallpaperManager 状态保持同步

## 设计理念
- 在桌面模式下提供熟悉的 Windows 任务栏体验
- 在移动模式下保持原有的触摸友好界面
- 平滑的过渡动画和视觉反馈
- 保持与现有系统的兼容性

*/
