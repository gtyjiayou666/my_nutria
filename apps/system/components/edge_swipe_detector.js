// 边缘滑动检测器 - 用于检测从屏幕边缘开始的滑动手势
// 主要用于移动模式下的退出应用手势

class EdgeSwipeDetector extends EventTarget {
  constructor() {
    super();
    
    // 边缘检测区域宽度（像素）
    this.edgeWidth = 30;
    
    // 最小滑动距离才触发手势 - 降低门槛使手势更容易触发
    this.minSwipeDistance = 60;
    
    // 最大滑动时间（毫秒） - 增加时间给用户更多操作空间
    this.maxSwipeTime = 1500;
    
    // 最大垂直偏移，超过则认为不是水平滑动 - 增加容差
    this.maxVerticalDeviation = 150;
    
    // 当前手势状态
    this.isGesturing = false;
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.isFromEdge = false;
    this.isDesktopMode = false;
    this.currentPointerId = -1;
    
    // 只在移动模式下启用
    this.enabled = false;
    
    // 防抖相关 - 降低防抖时间使手势响应更快
    this.lastGestureTime = 0;
    this.gestureDebounceTime = 400; // 400ms内不允许重复触发
    
    this.init();
  }
  
  init() {
    // 监听桌面模式变化
    window.addEventListener('desktop-mode-changed', (event) => {
      this.updateMode(event.detail.isDesktop);
    });
    
    // 监听来自 actionsDispatcher 的桌面模式变化
    if (window.actionsDispatcher) {
      actionsDispatcher.addListener("desktop-mode-changed", (_name, data) => {
        this.updateMode(data.isDesktop);
      });
    }
    
    // 获取初始状态 - 从 QuickSettings 或其他地方
    this.initializeMode();
    
    this.log('Edge swipe detector initialized');
  }
  
  async initializeMode() {
    // 尝试从设置中获取桌面模式状态
    try {
      if (window.apiDaemon) {
        const settings = await apiDaemon.getSettings();
        const result = await settings.get("ui.desktop-mode");
        this.updateMode(result.value);
      } else {
        // 默认为移动模式（启用边缘滑动）
        this.updateMode(false);
      }
    } catch (e) {
      // 如果获取设置失败，默认为移动模式
      this.updateMode(false);
    }
  }
  
  updateMode(isDesktop) {
    this.isDesktopMode = isDesktop;
    
    if (isDesktop) {
      // 桌面模式：禁用边缘滑动
      this.disable();
    } else {
      // 移动模式：启用边缘滑动
      this.enable();
    }
    
    this.log(`Mode updated: ${isDesktop ? 'desktop' : 'mobile'}, edge swipe ${this.enabled ? 'enabled' : 'disabled'}`);
  }
  
  enable() {
    if (this.enabled) return;
    
    this.enabled = true;
    
    this.boundHandlePointerDown = this.handlePointerDown.bind(this);
    this.boundHandlePointerMove = this.handlePointerMove.bind(this);
    this.boundHandlePointerUp = this.handlePointerUp.bind(this);
    this.boundHandlePointerCancel = this.handlePointerCancel.bind(this);
    
    document.addEventListener('pointerdown', this.boundHandlePointerDown, { passive: false });
    document.addEventListener('pointermove', this.boundHandlePointerMove, { passive: false });
    document.addEventListener('pointerup', this.boundHandlePointerUp, { passive: false });
    document.addEventListener('pointercancel', this.boundHandlePointerCancel, { passive: false });
    
    this.log('Edge swipe detection enabled for mobile mode');
  }
  
  disable() {
    if (!this.enabled) return;
    
    this.enabled = false;
    
    if (this.boundHandlePointerDown) {
      document.removeEventListener('pointerdown', this.boundHandlePointerDown);
      document.removeEventListener('pointermove', this.boundHandlePointerMove);
      document.removeEventListener('pointerup', this.boundHandlePointerUp);
      document.removeEventListener('pointercancel', this.boundHandlePointerCancel);
    }
    
    this.reset();
    this.log('Edge swipe detection disabled');
  }
  
  handlePointerDown(event) {
    if (!this.enabled || this.isGesturing) return;
    
    // 只处理主要指针（通常是第一个手指）
    if (event.isPrimary === false) return;
    
    // 检查是否从屏幕边缘开始
    const { clientX, clientY, pointerId } = event;
    const isFromLeftEdge = clientX <= this.edgeWidth;
    const isFromRightEdge = clientX >= window.innerWidth - this.edgeWidth;
    
    if (isFromLeftEdge || isFromRightEdge) {
      // 防抖检查
      const now = Date.now();
      if (now - this.lastGestureTime < this.gestureDebounceTime) {
        return;
      }
      
      this.isGesturing = true;
      this.isFromEdge = true;
      this.startX = clientX;
      this.startY = clientY;
      this.startTime = now;
      this.currentPointerId = pointerId;
      
      this.log(`Edge swipe started from ${isFromLeftEdge ? 'left' : 'right'} edge at (${clientX}, ${clientY})`);
      
      // 可选：触发触觉反馈
      if (window.hapticFeedback && window.hapticFeedback.trigger) {
        window.hapticFeedback.trigger('light');
      }
    }
  }
  
  handlePointerMove(event) {
    if (!this.enabled || !this.isGesturing || !this.isFromEdge) return;
    
    // 只处理相同的指针
    if (event.pointerId !== this.currentPointerId) return;
    
    const { clientX, clientY } = event;
    const deltaX = clientX - this.startX;
    const deltaY = Math.abs(clientY - this.startY);
    const elapsed = Date.now() - this.startTime;
    
    // 检查时间是否超限
    if (elapsed > this.maxSwipeTime) {
      this.log('Gesture timeout, canceling');
      this.reset();
      return;
    }
    
    // 检查垂直偏移是否过大
    if (deltaY > this.maxVerticalDeviation) {
      this.log('Vertical deviation too large, canceling gesture');
      this.reset();
      return;
    }
    
    // 检查是否达到最小滑动距离
    const distance = Math.abs(deltaX);
    if (distance >= this.minSwipeDistance) {
      // 检查滑动方向是否正确（从边缘向内滑动）
      const isLeftEdgeSwipeRight = this.startX <= this.edgeWidth && deltaX > 0;
      const isRightEdgeSwipeLeft = this.startX >= window.innerWidth - this.edgeWidth && deltaX < 0;
      
      if (isLeftEdgeSwipeRight || isRightEdgeSwipeLeft) {
        this.log(`Valid edge swipe detected: distance=${distance}, deltaX=${deltaX}, time=${elapsed}ms`);
        this.triggerBackGesture();
        this.reset();
      }
    }
  }
  
  handlePointerUp(event) {
    if (!this.enabled || !this.isGesturing) return;
    
    // 只处理相同的指针
    if (event.pointerId !== this.currentPointerId) return;
    
    this.log('Pointer up, gesture ended');
    this.reset();
  }
  
  handlePointerCancel(event) {
    if (!this.enabled || !this.isGesturing) return;
    
    // 只处理相同的指针
    if (event.pointerId !== this.currentPointerId) return;
    
    this.log('Pointer canceled, gesture ended');
    this.reset();
  }
  
  triggerBackGesture() {
    this.log('Triggering back gesture - attempting to exit app like Android');
    
    // 记录手势时间，用于防抖
    this.lastGestureTime = Date.now();
    
    // 分发边缘滑动事件
    this.dispatchEvent(new CustomEvent('edge-swipe-back', {
      detail: {
        timestamp: this.lastGestureTime,
        startX: this.startX,
        startY: this.startY
      }
    }));
    
    // Android风格的应用退出逻辑
    let backTriggered = false;
    
    // 方法1：通过 actionsDispatcher 发送Android风格退出命令
    if (window.actionsDispatcher) {
      actionsDispatcher.dispatch("android-back");
      backTriggered = true;
      this.log('Android-style back action dispatched via actionsDispatcher');
    }
    
    // 方法2：直接通过 window manager（备用方案）
    if (!backTriggered && window.wm) {
      const currentFrame = window.wm.currentFrame();
      
      if (currentFrame && !currentFrame.config.isHomescreen) {
        // 当前不在主屏幕，直接关闭当前应用
        window.wm.closeFrame();
        backTriggered = true;
        this.log('Direct app exit: Closed current frame and returned to homescreen');
      } else if (currentFrame && currentFrame.config.isHomescreen) {
        // 已经在主屏幕，尝试页面后退
        window.wm.goBack();
        backTriggered = true;
        this.log('On homescreen: triggered page back navigation');
      } else {
        // 没有当前窗口，返回主屏幕
        window.wm.goHome();
        backTriggered = true;
        this.log('No current frame: navigated to homescreen');
      }
    }
    
    // 方法3：浏览器历史回退 (fallback)
    if (!backTriggered && window.history && window.history.length > 1) {
      window.history.back();
      backTriggered = true;
      this.log('Back action triggered via browser history');
    }
    
    if (!backTriggered) {
      this.log('Warning: No back action method available');
    }
    
    // 触觉反馈
    if (window.hapticFeedback && window.hapticFeedback.trigger) {
      window.hapticFeedback.trigger('medium');
    }
  }
  
  reset() {
    this.isGesturing = false;
    this.isFromEdge = false;
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.currentPointerId = -1;
  }
  
  log(message) {
    console.log(`EdgeSwipeDetector: ${message}`);
  }
  
  // 公共API：手动启用/禁用
  forceEnable() {
    this.enable();
  }
  
  forceDisable() {
    this.disable();
  }
  
  // 公共API：检查状态
  isEnabled() {
    return this.enabled;
  }
  
  // 公共API：设置参数
  setParameters(params) {
    if (params.edgeWidth !== undefined) this.edgeWidth = params.edgeWidth;
    if (params.minSwipeDistance !== undefined) this.minSwipeDistance = params.minSwipeDistance;
    if (params.maxSwipeTime !== undefined) this.maxSwipeTime = params.maxSwipeTime;
    if (params.maxVerticalDeviation !== undefined) this.maxVerticalDeviation = params.maxVerticalDeviation;
    
    this.log(`Parameters updated: edgeWidth=${this.edgeWidth}, minSwipeDistance=${this.minSwipeDistance}`);
  }
}

// 创建全局边缘滑动检测器实例
if (typeof window !== 'undefined') {
  window.edgeSwipeDetector = new EdgeSwipeDetector();
}
