# gecko-b2g ------ 设计文档


目录

```
1 概述
2 多屏控制
  2.1 设计方案
  2.2 底层接口
  2.3 新增功能
    2.3.1 多分辨率自适应
    2.3.2 外接显示器热插拔识别(Linux)
    2.3.3 镜像模式
    2.3.4 扩展模式
3 屏幕录制
  2.1 设计方案
  2.2 底层接口
```

# 1 概述

本项目基于开源项目 capyloon 进行扩展，在 gecko-b2g 中针对 Linux 系统增加了多屏控制、屏幕录制功能，对 Android 系统增加了屏幕的分辨率控制。最终实现了屏幕分辨率自适应、外接显示器适配、移动模式桌面模式热切换、屏幕录制等功能。

本文档旨在为开发者提供我们对 gecko-b2g 中多屏控制、屏幕录制的设计方案。减少开发者在使用 gecko-b2g 时的学习成本。

下图为 capyloon 各组件直接的关系，以及桌面如何呈现。
![](resources/设计文档/assets/capyloon框架/1.png)

# 2 多屏控制

## 2.1 设计方案

Nutria 通过 XPCOM 框架使用 JS 对 Gecko 中的 C++ 代码的调用，Gecko 中通过 C++ 类的多态访问 Linux / Android 获取并更改屏幕信息。对于游览器父进程(system)，我们直接访问底层操作系统；对于内容进程(app)，我们通过进程间通信访问父进程，进而通过父进程访问操作系统。
![](resources/设计文档/assets/多屏控制/设计方案/1.svg)
![](resources/设计文档/assets/多屏控制/设计方案/2.svg)
![](resources/设计文档/assets/多屏控制/设计方案/3.svg)

对于 Linux 系统的多屏控制，我们选择 X11 的 RandR 扩展；对于 Android 的屏幕控制，我们使用 SurfaceFlinger 设置屏幕的分辨率。
![](resources/设计文档/assets/多屏控制/设计方案/4.svg)

> 目前 Linux 系统支持双屏所有控制，Android 系统支持单屏幕的分辨率控制。

---

## 2.2 底层接口

(1) 获取当前显示器数目：getScreenNum
| 子模块 | 编程语言 | 声明 | 描述 |
| ------------ | -------- | -------------------------------------- | ------------------------------------------------------------ |
| 获取当前显示器数目 | C++   | DOMRequest getScreenNum() | 返回当前连接的显示器数目给 Nutria 前端 |
|   |    | 参数说明   | 返回值说明  |
|    |    | 无 | long,当前显示器数目 如：1 |

---

(2) 获取当前显示器数目：getDisplayType

<table style="width: auto;"><tbody><tr><td colSpan="1" rowSpan="2" width="75">枚举类型</td><td colSpan="1" rowSpan="1" width="492">enum DisplayType { MirrorReplication, Extension };</td></tr></tbody></table>

> DisplayType：显示器投影模式

| 子模块 | 编程语言 | 声明 | 描述 |
| ------------ | -------- | -------------------------------------- | ------------------------------------------------------------ |
| 获取当前显示器投影模式 | C++   | DOMRequest getDisplayType() | 返回当前连接的显示器投影模式给 Nutria 前端 |
|   |    | 参数说明   | 返回值说明  |
|    |    | 无 | long,当前显示器投影模式 如：1(Extension) |

---

(3) 获取目标显示器当前分辨率：getCurrentResolution

| 子模块 | 编程语言 | 声明 | 描述 |
| ------------ | -------- | -------------------------------------- | ------------------------------------------------------------ |
| 获取目标显示器当前分辨率 | C++   | DOMRequest getCurrentResolution(long index) | 返回目标显示器当前分辨率给 Nutria 前端 |
|   |    | 参数说明   | 返回值说明  |
|    |    | index：目标显示器对应索引 | Resolution { "width": long, "height": long },显示器当前分辨率 如：{ 1920, 1080 } |

---

(4) 获取目标显示器当前分辨率：getScreenResolutions

| 子模块 | 编程语言 | 声明 | 描述 |
| ------------ | -------- | -------------------------------------- | ------------------------------------------------------------ |
| 获取目标显示器支持的所有分辨率 | C++   | DOMRequest getScreenResolutions(long index) | 返回目标显示器支持的所有分辨率给 Nutria 前端 |
|   |    | 参数说明   | 返回值说明  |
|    |    | index：目标显示器对应索引 | squence\<Resolution> [ { "width": long, "height": long }, ... ],显示器当前分辨率 如：[ { 1920, 1080 }, { 1280, 720 } ] |

(5) 设置目标显示器状态：setResolution

| 子模块 | 编程语言 | 声明 | 描述 |
| ------------ | -------- | -------------------------------------- | ------------------------------------------------------------ |
| 设置目标显示器状态 | C++   | DOMRequest setResolution(long index, long displayType, long newWidth, long newHeight) | 后端实现显示器自适应分辨率及投影模式 |
|   |    | 参数说明   | 返回值说明  |
|    |    | index：目标显示器对应索引; displayType：显示器投影模式; newWidth：显示器新宽度; newHeight：显示器新高度; | 成功返回SUCCESS |

---

## 2.3 新增功能

### 2.3.1 多分辨率自适应

下图为设置分辨率时，Nutria 与 Gecko 之间的交互。
<img src="resources/设计文档/assets/多屏控制/多分辨率/1.svg" alt="Description of SVG" style=" display: block;" >

---

### 2.3.2 外接显示器热插拔识别(Linux)

对于原本的 Gecko 引擎，在显示器外接后，linux 内核识别并注册显示器接口(HDMI 接口)，ubuntu桌面内置进行激活显示器，Gecko 引擎通过 GTK 监听 monitors-changed 信号，实现对外接显示器的识别。
![](resources/设计文档/assets/多屏控制/外接显示器热插拔识别/1.png)
当我们使用 capyloon 替换 ubuntu 原本桌面系统，Gecko 引擎不会自动激活显示器，无法监听外接显示器的热插拔信号。我们在 widget/gtk 下对Gecko 引擎 Linux 系统下的窗口管理模块进行修改，让 Gecko 引擎本身支持外接显示器激活。
![](resources/设计文档/assets/多屏控制/外接显示器热插拔识别/2.png)
下图为各模块之间交互过程。
<img src="resources/设计文档/assets/多屏控制/外接显示器热插拔识别/1.svg" alt="Description of SVG" style=" display: block;" >

---

### 2.3.3 镜像模式

<div>
开启镜像模式有两种方式
<div style="margin-left: 30px;">  
1）当 Gecko 引擎识别到外接显示器时，会默认开启镜像模式。<br>2) 在显示偏好中选择镜像模式。
</div>
</div>  
下图为各模块之间交互过程。
<img src="resources/设计文档/assets/多屏控制/镜像模式/1.svg" alt="Description of SVG" style=" display: block;" >

镜像模式表现为：等比例缩放主屏幕桌面，支持主副屏幕使用不同分辨率。
![](resources/设计文档/assets/多屏控制/镜像模式/1.png)

---

### 2.3.4 扩展模式
<div>
我们在外接显示器上通过扩展的方式实现了移动模式与桌面模式之间的热切换。
<div style="margin-left: 30px;">  
1）当我们在显示偏好中选择扩展模式后，主显示器黑屏，外接显示器会切换到桌面模式。<br>2）当我们在显示偏好中选择镜像模式后，主显示器切换到移动模式，外接显示器镜像复制主显示器。  
<br>3）当拔掉外接显示器的 HDMI 接口后，主显示器还原回移动模式。
</div>
</div>
下图为选择扩展模式，各模块之间交互过程。
<img src="resources/设计文档/assets/多屏控制/扩展模式/1.svg" alt="Description of SVG" style=" display: block;" >

![](resources/设计文档/assets/多屏控制/扩展模式/1.png)

下图为扩展模式切换为镜像模式，各模块之间交互过程。
<img src="resources/设计文档/assets/多屏控制/扩展模式/2.svg" alt="Description of SVG" style=" display: block;" >

![](resources/设计文档/assets/多屏控制/扩展模式/2.png)

下图为扩展模式拔掉外接显示器 HDMI 接口，各模块之间交互过程。
<img src="resources/设计文档/assets/多屏控制/扩展模式/3.svg" alt="Description of SVG" style=" display: block;" >

![](resources/设计文档/assets/多屏控制/扩展模式/3.png)

---

# 3 屏幕录制

为什么我们做屏幕录制功能，我们比赛时需要提交一段视频展示作品，为了保证较好的清晰度，我们做了一个录屏app，选择在系统中进行屏幕录制。

## 3.1 设计方案

由于我们展示成果的时候使用的 Linux 系统，所以我们的录屏仅支持 Linux 系统。我们只是简单的在底层调用 **ffmpeg** 命令，实现一个方便可用的屏幕录制接口。

我们没有专门针对内容进程通过进程间通信访问主进程，而是直接让内容进程访问底层 Linux 内核。**这种做法其实是不可取的，仅比赛使用**。


## 3.2 底层接口

| 子模块 | 编程语言 | 声明 | 描述 |
| ------------ | -------- | -------------------------------------- | ------------------------------------------------------------ |
| 开始屏幕录制 | JavaScript (Web API) | `Promise<undefined> start(USVString outputFile, unsigned long width, unsigned long height, unsigned long framerate)` | 启动系统级屏幕录制，将当前显示内容编码并保存到指定文件。需传入输出路径及视频参数（分辨率、帧率）。调用后返回 Promise，成功则 resolve，失败则 reject。 |
|   |    | **参数说明**   | **返回值说明**  |
|    |    | - `outputFile`: 输出视频文件的完整路径（如 `/tmp/recording.mp4`）<br>- `width`: 视频宽度（像素）<br>- `height`: 视频高度（像素）<br>- `framerate`: 视频帧率（FPS） | Promise 对象：<br>- 成功：resolve `undefined`，表示录制已启动<br>- 失败：reject 错误信息（如权限不足、路径无效等） |

| 子模块 | 编程语言 | 声明 | 描述 |
| ------------ | -------- | -------------------------------------- | ------------------------------------------------------------ |
| 停止屏幕录制 | JavaScript (Web API) | `[Throws] Promise<undefined> stop()` | 停止当前正在进行的屏幕录制任务。调用后立即结束录制并将最终视频文件写入磁盘。返回 Promise 以通知操作结果。 |
|   |    | **参数说明**   | **返回值说明**  |
|    |    | 无 | Promise 对象：<br>- 成功：resolve `undefined`，表示录制已成功停止并保存<br>- 失败：reject 错误信息（如未在录制状态、写入失败等） |