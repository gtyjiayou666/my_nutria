
const kDeps = [
    {
        name: "main",
        kind: "virtual",
        deps: [
            "content manager",
        ],
    },
    {
        name: "api daemon core",
        kind: "sharedWindowModule",
        param: ["js/api_daemon.js", "apiDaemon", "ApiDaemon"],
    },
    {
        name: "content manager",
        kind: "sharedWindowModule",
        param: ["js/content_manager.js", "contentManager", "ContentManager"],
        deps: ["api daemon core"],
    }
];

let screenRecorder = null;
let isRecording = false;
let startTime = 0;
let durationInterval = null;

// DOM 元素缓存
const elements = {
    recordBtn: document.getElementById('recordBtn'),
    statusText: document.getElementById('statusText'),
    duration: document.getElementById('duration'),
    previewContainer: document.getElementById('previewContainer'),
    preview: document.getElementById('preview'),
    resolution: document.getElementById('resolution'),
    framerate: document.getElementById('framerate'),
    format: document.getElementById('format')
};

// ✅ 等待 contentManager 就绪
async function waitForContentManager() {
    let attempts = 0;
    while (!contentManager && attempts < 60) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    if (!contentManager) {
        throw new Error("contentManager 未定义或超时");
    }
    console.info("✅ contentManager 已就绪");
}

function updateResolutionOptions() {
    const el = document.getElementById('resolution');
    const width = window.screen.width;
    const height = window.screen.height;

    let resolutionLabel = `${width}x${height}`;

    el.textContent = resolutionLabel;
}

// ✅ 初始化录屏服务
async function initRecorder() {
    try {
        // 等待 contentManager
        await waitForContentManager();
    } catch (err) {
        showError("❌ contentManager 不可用: " + err.message);
        return;
    }
    updateResolutionOptions();
    window.addEventListener('resize', updateResolutionOptions);

    // 检查 B2G screenRecorderService
    if (!navigator.b2g || !navigator.b2g.screenRecorderService) {
        showError("❌ screenRecorderService 不可用");
        return;
    }

    screenRecorder = navigator.b2g.screenRecorderService;
    console.info("✅ 获取 screenRecorderService:", screenRecorder);

    // 绑定事件
    elements.recordBtn.addEventListener('click', handleRecordToggle);
    startStatusPolling();

    updateUI();

}

// ✅ 轮询录制状态
function startStatusPolling() {
    setInterval(() => {
        const wasRecording = isRecording;
        isRecording = screenRecorder?.isRecording === true;

        if (wasRecording !== isRecording) {
            console.debug("🔄 录制状态变化:", isRecording);
            if (isRecording) {
                onRecordingStart();
            } else {
                onRecordingStop();
            }
        }
    }, 300);
}

// ✅ 处理录制按钮
async function handleRecordToggle() {
    if (isRecording) {
        await stopRecording();
    } else {
        await startRecording();
    }
}

// ✅ 开始录制
async function startRecording() {
    const resolution = elements.resolution.textContent;
    const framerate = parseInt(elements.framerate.value);
    const format = elements.format.value;
    const [width, height] = resolution.split('x').map(Number);

    const outputDir = '/tmp/';
    const filename = `rec_${Date.now()}.${format}`;
    const outputFile = outputDir + filename;

    // 保存路径供后续导入
    localStorage.setItem('lastRecordingFile', outputFile);

    try {
        updateStatus("🚀 启动录制...");
        await screenRecorder.start(outputFile, width, height, framerate);
        console.info("✅ 录制已启动:", outputFile);
    } catch (err) {
        console.error("❌ 启动失败:", err);
        showError(`启动失败: ${err.message || err}`);
    }
}

// ✅ 停止录制
async function stopRecording() {
    try {
        updateStatus("🛑 停止录制...");
        await screenRecorder.stop();
        console.info("✅ 录制已停止");
    } catch (err) {
        console.error("❌ 停止失败:", err);
        showError(`停止失败: ${err.message || err}`);
    }
}

// ✅ 录制开始回调
function onRecordingStart() {
    isRecording = true;
    startTime = Date.now();

    if (durationInterval) clearInterval(durationInterval);
    durationInterval = setInterval(updateDuration, 1000);
    updateDuration();

    elements.recordBtn.textContent = '⏹️ 停止录制';
    elements.recordBtn.classList.add('recording');
    updateStatus("🔴 正在录制...");
    hidePreview();
}

// ✅ 录制停止回调（核心：导入文件 + 预览）
async function onRecordingStop() {
    isRecording = false;
    if (durationInterval) clearInterval(durationInterval);

    elements.recordBtn.textContent = '🔴 开始录制';
    elements.recordBtn.classList.remove('recording');

    const lastOutputFile = localStorage.getItem('lastRecordingFile');
    if (!lastOutputFile) {
        showError("❌ 未找到录制文件路径");
        return;
    }

    try {
        updateStatus("🔄 正在保存到文件管理器...");

        await contentManager.as_superuser();
        const svc = await contentManager.getService();
        const container = await contentManager.ensureTopLevelContainer("Screen Recordings");

        // 导入文件（复制）
        const metadata = await svc.importFromPath(container, lastOutputFile, true);
        console.info("文件已导入:", metadata.id);

        // 获取资源 URL
        const resource = await contentManager.resourceFromId(metadata.id);
        const url = resource.variantUrl();

        // 设置预览和下载
        elements.preview.src = url;
        elements.preview.load();

        showPreview();
        updateStatus("✅ 已保存到【Screen Recordings】");

    } catch (err) {
        console.error("导入失败:", err);
        showError(`保存失败: ${err.message || err}`);
    }
}

function updateStatus(text) {
    elements.statusText.textContent = text;
}

function showError(text) {
    elements.statusText.innerHTML = `<span style="color:#cc0000">${text}</span>`;
}

function updateDuration() {
    const elapsed = Date.now() - startTime;
    const totalSec = Math.floor(elapsed / 1000);
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    elements.duration.textContent = `${h}:${m}:${s}`;
}

function showPreview() {
    elements.previewContainer.style.display = 'block';
}

function hidePreview() {
    elements.previewContainer.style.display = 'none';
}

function updateUI() {
    elements.recordBtn.disabled = !screenRecorder;
    if (!screenRecorder) {
        updateStatus("❌ 服务未就绪");
    }
}

// ✅ 页面加载
document.addEventListener('DOMContentLoaded', async () => {
    await depGraphLoaded;

    let graph = new ParallelGraphLoader(addSharedDeps(addShoelaceDeps(kDeps)));
    await Promise.all(
        ["content manager"].map((dep) =>
            graph.waitForDeps(dep)
        )
    );

    initRecorder();
});

// ✅ 页面卸载清理
window.addEventListener('beforeunload', () => {
    if (durationInterval) clearInterval(durationInterval);
    if (screenRecorder && isRecording) {
        console.info("⚠️ 页面关闭，尝试停止录制");
        screenRecorder.stop().catch(console.error);
    }
});