// 边缘滑动检测器 - 用于检测从屏幕边缘开始的滑动手势
// 主要用于移动模式下的退出应用手势

class EdgeSwipeDetector extends EventTarget {
  constructor(isDesktop) {
    super();
    this.isDesktop = isDesktop;
    
    // 边缘检测区域宽度（像素）
    this.edgeWidth = 30;
    
    // 手势阈值配置
    this.minSwipeDistance = 60;        // 最小滑动距离才触发手势
    this.commitThreshold = 120;        // 确认退出的阈值距离
    this.maxSwipeTime = 1500;          // 最大滑动时间（毫秒）
    this.maxVerticalDeviation = 150;   // 最大垂直偏移
    
    // 当前手势状态
    this.isGesturing = false;
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.isFromEdge = false;
    this.isDesktopMode = false;
    this.currentPointerId = -1;
    
    // 新增手势状态管理
    this.swipeState = 'none';          // 'none' | 'swiping' | 'ready_to_exit' | 'committed'
    this.currentDistance = 0;          // 当前滑动距离
    this.maxReachedDistance = 0;       // 本次手势达到的最大距离
    
    // 只在移动模式下启用
    this.enabled = false;
    
    // 防抖相关 - 降低防抖时间使手势响应更快
    this.lastGestureTime = 0;
    this.gestureDebounceTime = 400; // 400ms内不允许重复触发
    
    // 滑动指示器相关
    this.swipeIndicator = null;
    this.swipeDirection = null;
    
    this.init();
  }
  
  init() {
    // 监听桌面模式变化
    window.addEventListener('desktop-mode-changed', (event) => {
      this.updateMode(event.detail.isDesktop);
    });
    
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
      this.swipeDirection = isFromLeftEdge ? 'right' : 'left';
      
      // 初始化新的手势状态
      this.swipeState = 'swiping';
      this.currentDistance = 0;
      this.maxReachedDistance = 0;
      
      // 创建并显示滑动箭头提示
      this.createSwipeIndicator(clientX, clientY, this.swipeDirection);
      
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
      this.removeSwipeIndicator();
      this.reset();
      return;
    }
    
    // 检查垂直偏移是否过大
    if (deltaY > this.maxVerticalDeviation) {
      this.log('Vertical deviation too large, canceling gesture');
      this.removeSwipeIndicator();
      this.reset();
      return;
    }
    
    // 计算当前滑动距离（绝对值）
    this.currentDistance = Math.abs(deltaX);
    this.maxReachedDistance = Math.max(this.maxReachedDistance, this.currentDistance);
    
    // 检查滑动方向是否正确（从边缘向内滑动）
    const isLeftEdgeSwipeRight = this.startX <= this.edgeWidth && deltaX > 0;
    const isRightEdgeSwipeLeft = this.startX >= window.innerWidth - this.edgeWidth && deltaX < 0;
    const isValidDirection = isLeftEdgeSwipeRight || isRightEdgeSwipeLeft;
    
    if (!isValidDirection) {
      // 滑动方向错误，取消手势
      this.removeSwipeIndicator();
      this.reset();
      return;
    }
    
    // 状态管理和视觉反馈
    const prevState = this.swipeState;
    
    if (this.currentDistance >= this.commitThreshold) {
      // 达到确认退出阈值
      if (this.swipeState !== 'ready_to_exit') {
        this.swipeState = 'ready_to_exit';
        this.log(`Swipe ready to exit at distance: ${this.currentDistance}px`);
        
        // 触发触觉反馈表示达到阈值
        if (window.hapticFeedback && window.hapticFeedback.trigger) {
          window.hapticFeedback.trigger('medium');
        }
      }
    } else if (this.currentDistance >= this.minSwipeDistance) {
      // 达到最小滑动距离但未达到确认阈值
      if (this.swipeState !== 'swiping') {
        this.swipeState = 'swiping';
      }
    }
    
    // 检查是否从ready_to_exit状态回拉到阈值以下
    if (prevState === 'ready_to_exit' && this.currentDistance < this.commitThreshold) {
      this.swipeState = 'swiping';
      this.log(`Swipe pulled back below threshold, distance: ${this.currentDistance}px`);
      
      // 轻微触觉反馈表示离开退出区域
      if (window.hapticFeedback && window.hapticFeedback.trigger) {
        window.hapticFeedback.trigger('light');
      }
    }
    
    // 更新滑动指示器
    this.updateSwipeIndicator(clientX, clientY, deltaX);
  }
  
  handlePointerUp(event) {
    if (!this.enabled || !this.isGesturing) return;
    
    // 只处理相同的指针
    if (event.pointerId !== this.currentPointerId) return;
    
    this.log(`Pointer up, gesture ended. State: ${this.swipeState}, distance: ${this.currentDistance}px, max: ${this.maxReachedDistance}px`);
    
    // 判断是否应该触发退出
    if (this.swipeState === 'ready_to_exit' && this.currentDistance >= this.commitThreshold) {
      this.log('Triggering exit on pointer up - threshold reached and maintained');
      
      // 显示成功动画
      this.showSwipeSuccess();
      
      // 触发退出手势
      setTimeout(() => {
        this.triggerBackGesture();
        this.removeSwipeIndicator();
        this.reset();
      }, 150); // 稍微延长动画时间让用户看到反馈
      
    } else {
      // 未达到阈值或已回拉，不触发退出
      const reason = this.currentDistance < this.commitThreshold ? 
        'threshold not reached' : 'pulled back before release';
      this.log(`Not triggering exit: ${reason}`);
      
      // 显示取消动画
      this.showSwipeCancel();
      
      // 延迟清理，让用户看到取消反馈
      setTimeout(() => {
        this.removeSwipeIndicator();
        this.reset();
      }, 300);
    }
  }
  
  handlePointerCancel(event) {
    if (!this.enabled || !this.isGesturing) return;
    
    // 只处理相同的指针
    if (event.pointerId !== this.currentPointerId) return;
    
    this.log('Pointer canceled, gesture ended');
    this.removeSwipeIndicator();
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
    this.swipeDirection = null;
    
    // 重置新的状态变量
    this.swipeState = 'none';
    this.currentDistance = 0;
    this.maxReachedDistance = 0;
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
    if (params.commitThreshold !== undefined) this.commitThreshold = params.commitThreshold;
    if (params.maxSwipeTime !== undefined) this.maxSwipeTime = params.maxSwipeTime;
    if (params.maxVerticalDeviation !== undefined) this.maxVerticalDeviation = params.maxVerticalDeviation;
    
    this.log(`Parameters updated: edgeWidth=${this.edgeWidth}, minSwipeDistance=${this.minSwipeDistance}, commitThreshold=${this.commitThreshold}`);
  }
  
  // 创建滑动箭头指示器
  createSwipeIndicator(x, y, direction) {
    // 移除可能存在的旧指示器
    this.removeSwipeIndicator();
    
    // 创建主容器
    this.swipeIndicator = document.createElement('div');
    this.swipeIndicator.className = 'edge-swipe-indicator';
    this.swipeIndicator.style.cssText = `
      position: fixed;
      z-index: 10000;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      left: ${x - 20}px;
      top: ${y - 20}px;
      width: 40px;
      height: 40px;
    `;
    
    // 创建箭头图标
    const arrow = document.createElement('div');
    arrow.className = 'swipe-arrow';
    arrow.style.cssText = `
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-size: 20px;
      opacity: 0;
      transform: scale(0.5);
      animation: swipeIndicatorIn 0.2s ease-out forwards;
    `;
    
    // 设置箭头方向
    arrow.textContent = direction === 'right' ? '→' : '←';
    
    // 创建进度指示器
    const progress = document.createElement('div');
    progress.className = 'swipe-progress';
    progress.style.cssText = `
      position: absolute;
      top: -5px;
      left: -5px;
      right: -5px;
      bottom: -5px;
      border: 3px solid transparent;
      border-radius: 50%;
      border-top-color: #4CAF50;
      transform: rotate(-90deg);
      transition: border-top-color 0.2s ease;
    `;
    
    this.swipeIndicator.appendChild(arrow);
    this.swipeIndicator.appendChild(progress);
    
    // 添加CSS动画
    if (!document.getElementById('edge-swipe-styles')) {
      const style = document.createElement('style');
      style.id = 'edge-swipe-styles';
      style.textContent = `
        @keyframes swipeIndicatorIn {
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes swipeSuccess {
          0% { 
            background-color: rgba(255, 255, 255, 0.9);
            transform: scale(1);
          }
          50% { 
            background-color: rgba(76, 175, 80, 0.9);
            transform: scale(1.2);
          }
          100% { 
            background-color: rgba(76, 175, 80, 0.9);
            transform: scale(1);
          }
        }
        
        .edge-swipe-indicator .swipe-arrow.success {
          animation: swipeSuccess 0.3s ease-out;
          background: rgba(76, 175, 80, 0.9) !important;
          color: white !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(this.swipeIndicator);
    this.log(`Swipe indicator created at (${x}, ${y}) direction: ${direction}`);
  }
  
  // 更新滑动指示器位置和进度
  updateSwipeIndicator(x, y, deltaX) {
    if (!this.swipeIndicator) return;
    
    // 计算基于commitThreshold的滑动进度 (0-1)
    const progress = Math.min(Math.abs(deltaX) / this.commitThreshold, 1);
    const minProgress = Math.min(Math.abs(deltaX) / this.minSwipeDistance, 1);
    
    // 更新位置
    this.swipeIndicator.style.left = `${x - 20}px`;
    this.swipeIndicator.style.top = `${y - 20}px`;
    
    // 获取元素
    const progressElement = this.swipeIndicator.querySelector('.swipe-progress');
    const arrow = this.swipeIndicator.querySelector('.swipe-arrow');
    
    if (progressElement) {
      const angle = progress * 360;
      let color = '#2196F3'; // 默认蓝色
      
      // 根据状态改变颜色
      if (this.swipeState === 'ready_to_exit') {
        color = '#4CAF50'; // 绿色表示可以退出
      } else if (minProgress > 0.5) {
        color = '#FF9800'; // 橙色表示正在滑动
      }
      
      progressElement.style.background = `
        conic-gradient(
          ${color} 0deg ${angle}deg,
          rgba(255, 255, 255, 0.3) ${angle}deg 360deg
        )
      `;
      progressElement.style.borderTopColor = color;
    }
    
    if (arrow) {
      // 根据状态更新箭头样式
      if (this.swipeState === 'ready_to_exit') {
        arrow.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
        arrow.style.color = 'white';
        arrow.textContent = '→';
      } else if (minProgress > 0.3) {
        arrow.style.backgroundColor = 'rgba(255, 152, 0, 0.9)';
        arrow.style.color = 'white';
        arrow.textContent = '→';
      } else {
        arrow.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        arrow.style.color = '#333';
        arrow.textContent = '→';
      }
    }
    
    this.log(`Swipe indicator updated: progress=${progress.toFixed(2)}, state=${this.swipeState}, distance=${Math.abs(deltaX).toFixed(0)}px`);
  }
  
  // 显示成功动画
  showSwipeSuccess() {
    if (!this.swipeIndicator) return;
    
    const arrow = this.swipeIndicator.querySelector('.swipe-arrow');
    if (arrow) {
      arrow.classList.add('success');
      arrow.textContent = '✓';
      arrow.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
      arrow.style.color = 'white';
    }
    
    const progressElement = this.swipeIndicator.querySelector('.swipe-progress');
    if (progressElement) {
      progressElement.style.background = 'rgba(76, 175, 80, 0.9)';
    }
    
    // 触发强烈的触觉反馈
    if (window.hapticFeedback && window.hapticFeedback.trigger) {
      window.hapticFeedback.trigger('heavy');
    }
    
    this.log('Swipe success animation triggered');
  }
  
  // 显示取消动画
  showSwipeCancel() {
    if (!this.swipeIndicator) return;
    
    const arrow = this.swipeIndicator.querySelector('.swipe-arrow');
    if (arrow) {
      arrow.textContent = '✗';
      arrow.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
      arrow.style.color = 'white';
    }
    
    const progressElement = this.swipeIndicator.querySelector('.swipe-progress');
    if (progressElement) {
      progressElement.style.background = 'rgba(244, 67, 54, 0.3)';
    }
    
    // 轻微触觉反馈表示取消
    if (window.hapticFeedback && window.hapticFeedback.trigger) {
      window.hapticFeedback.trigger('light');
    }
    
    this.log('Swipe cancel animation triggered');
  }
  
  // 移除滑动指示器
  removeSwipeIndicator() {
    if (this.swipeIndicator && this.swipeIndicator.parentNode) {
      this.swipeIndicator.style.opacity = '0';
      this.swipeIndicator.style.transform = 'scale(0.5)';
      
      setTimeout(() => {
        if (this.swipeIndicator && this.swipeIndicator.parentNode) {
          this.swipeIndicator.parentNode.removeChild(this.swipeIndicator);
        }
        this.swipeIndicator = null;
      }, 200);
    }
  }
}

// 创建全局边缘滑动检测器实例
if (typeof window !== 'undefined') {
  window.edgeSwipeDetector = new EdgeSwipeDetector((embedder.sessionType === "desktop" || embedder.sessionType === "session"));
}
