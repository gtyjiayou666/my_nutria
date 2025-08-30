// 假设 ScreenRecorder 已经被定义并可用
let screenRecorder;

async function initScreenRecorder() {
  try {
    // 创建 ScreenRecorder 实例
    screenRecorder = navigator.b2g.screenRecorderService;

    // 更新状态显示
    updateStatus();

    document.getElementById('startBtn').addEventListener('click', async () => {
      // 设置输出文件名（这里仅作示例，实际中可能需要更复杂的逻辑）
      const outputFile = '/home/gty/gameplay.avi';
      const width = 1280; // 示例宽度
      const height = 720; // 示例高度
      const framerate = 30; // 示例帧率
      console.info("##############################")
      if (screenRecorder) {
        console.info("have screenrecorder")
      }

      await screenRecorder.start(outputFile, width, height, framerate);
      updateStatus();
      toggleButtons();
    });

    document.getElementById('stopBtn').addEventListener('click', async () => {
      await screenRecorder.stop();
      updateStatus();
      toggleButtons();
    });
  } catch (e) {
    console.error("Failed to initialize ScreenRecorder:", e);
  }
}

function updateStatus() {
  const statusElement = document.getElementById('status');
  if (screenRecorder.isRecording) {
    statusElement.textContent = "Recording in progress...";
  } else {
    statusElement.textContent = "Not recording";
  }
}

function toggleButtons() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  startBtn.classList.toggle('hidden');
  stopBtn.classList.toggle('hidden');
}

// 初始化
// initScreenRecorder();
document.addEventListener("DOMContentLoaded", () => {
  initScreenRecorder();
  console.log(`DOM content loaded for screenrecorder`);
});
