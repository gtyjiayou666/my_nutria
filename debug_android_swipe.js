// Android Edge Swipe Debug Console
// 在浏览器开发者工具中运行此脚本来测试Android风格边缘滑动功能

console.log('🤖 Android Edge Swipe Debug Console');
console.log('=================================');

// 检查系统组件是否加载
function checkSystemComponents() {
    console.log('\n📋 检查系统组件状态:');
    
    // 检查 actionsDispatcher
    if (window.actionsDispatcher) {
        console.log('✅ actionsDispatcher: 已加载');
    } else {
        console.log('❌ actionsDispatcher: 未找到');
    }
    
    // 检查 WindowManager
    if (window.wm) {
        console.log('✅ WindowManager: 已加载');
        
        // 检查 androidBack 方法
        if (typeof window.wm.androidBack === 'function') {
            console.log('✅ WindowManager.androidBack(): 已实现');
        } else {
            console.log('❌ WindowManager.androidBack(): 未找到');
        }
        
        // 检查当前frame
        const currentFrame = window.wm.currentFrame();
        if (currentFrame) {
            console.log(`✅ 当前Frame: ${window.wm.activeFrame}`);
            console.log(`   - 是主屏幕: ${currentFrame.config.isHomescreen ? '是' : '否'}`);
            console.log(`   - Frame ID: ${currentFrame.getAttribute('id')}`);
        } else {
            console.log('❌ 当前Frame: 未找到');
        }
    } else {
        console.log('❌ WindowManager: 未找到');
    }
    
    // 检查边缘滑动检测器
    if (window.edgeSwipeDetector) {
        console.log('✅ EdgeSwipeDetector: 已加载');
        console.log(`   - 状态: ${window.edgeSwipeDetector.isEnabled() ? '已启用' : '已禁用'}`);
    } else {
        console.log('❌ EdgeSwipeDetector: 未找到');
    }
}

// 测试Android风格退出
function testAndroidBack() {
    console.log('\n🧪 测试Android风格退出:');
    
    if (window.actionsDispatcher) {
        console.log('发送 android-back 动作...');
        actionsDispatcher.dispatch("android-back");
        console.log('✅ android-back 动作已发送');
    } else {
        console.log('❌ 无法发送动作：actionsDispatcher 未找到');
    }
}

// 测试传统返回
function testTraditionalBack() {
    console.log('\n⬅️ 测试传统返回:');
    
    if (window.actionsDispatcher) {
        console.log('发送 go-back 动作...');
        actionsDispatcher.dispatch("go-back");
        console.log('✅ go-back 动作已发送');
    } else {
        console.log('❌ 无法发送动作：actionsDispatcher 未找到');
    }
}

// 模拟边缘滑动事件
function simulateEdgeSwipe() {
    if (window.edgeSwipeDetector) {
        // 创建模拟的边缘滑动事件
        const mockEvent = new CustomEvent('edge-swipe-back', {
            detail: {
                timestamp: Date.now(),
                startX: 10,  // 从左边缘开始
                startY: 100
            }
        });
        
        window.edgeSwipeDetector.dispatchEvent(mockEvent);
        
        // 直接调用 triggerBackGesture
        if (typeof window.edgeSwipeDetector.triggerBackGesture === 'function') {
            window.edgeSwipeDetector.triggerBackGesture();
        }
        
    } else {
        console.log('❌ 无法模拟：EdgeSwipeDetector 未找到');
    }
}

// 显示系统信息
function showSystemInfo() {
    console.log('\n🔍 系统信息:');
    console.log(`   - User Agent: ${navigator.userAgent}`);
    console.log(`   - 视口大小: ${window.innerWidth} x ${window.innerHeight}`);
    console.log(`   - 当前URL: ${window.location.href}`);
    
    // 检查移动模式
    if (window.apiDaemon) {
        console.log('   - ApiDaemon: 已加载');
    } else {
        console.log('   - ApiDaemon: 未加载');
    }
}

// 主函数
function debugAndroidEdgeSwipe() {
    checkSystemComponents();
    showSystemInfo();
    
    console.log('\n🎯 可用的测试命令:');
    console.log('   - testAndroidBack()     // 测试Android风格退出');
    console.log('   - testTraditionalBack() // 测试传统返回');
    console.log('   - simulateEdgeSwipe()   // 模拟边缘滑动');
    console.log('   - checkSystemComponents() // 重新检查组件');
    
    console.log('\n💡 使用说明:');
    console.log('   1. 首先运行 checkSystemComponents() 确认组件加载状态');
    console.log('   2. 使用 testAndroidBack() 测试Android风格退出功能');
    console.log('   3. 在移动设备上从屏幕边缘滑动来测试真实手势');
}

// 导出函数到全局作用域
window.debugAndroidEdgeSwipe = debugAndroidEdgeSwipe;
window.testAndroidBack = testAndroidBack;
window.testTraditionalBack = testTraditionalBack;
window.simulateEdgeSwipe = simulateEdgeSwipe;
window.checkSystemComponents = checkSystemComponents;
window.showSystemInfo = showSystemInfo;

// 自动运行初始检查
debugAndroidEdgeSwipe();
