# capyloon ------ 开发指南


目录

```
1 概述
2 部署方式
  2.1 nutria
  2.2 gecko-b2g
3 镜像制作
  3.1 linux x86
  3.2 linux arm
  3.3 gonk
```
---

# 1 概述

 本项目基于开源项目 capyloon 进行扩展，在 gecko-b2g 中针对 linux 系统增加了多屏控制，在 nutria 中增加了桌面模式。最终实现了屏幕分辨率自适应、外接屏幕适配、移动模式桌面模式热切换等功能。

 本文档旨在为开发者提供编译部署 capyloon 的方法。减少开发者在使用 capyloon 时的学习成本。

 capyloon 的整体模块介绍如下：

| 模块 | 描述 |
|---|---|
| gecko-b2g | 它是连接底层硬件与上层Web应用的桥梁。核心功能是对Web内容的全面渲染支持和系统级的集成能力。它使用Gecko引擎解析和渲染HTML、CSS，并支持JavaScript、SVG、WebGL等标准，同时扩展了Web API（如 navigator.moz* 接口），使 Web 应用能够访问显示器、摄像头、蓝牙、电话等底层硬件资源。系统层面，Gecko提供如 MozWifiManager、MozSettings和 MozTelephony等接口，并通过privileged权限机制控制访问，确保安全性； |
| nutria | 使用web技术实现的前端桌面，通过调用Gecko引擎提供的API，可以对各个硬件进行控制；|
---

# 2 部署方式
准备 ubuntu22.04 以上版本的服务器。以下部署仅支持 linux x86 架构，其他架构类似。

---
## 2.1 nutria
预备安装各种软件包
```
$ cd ~
$ sudo apt update
$ sudo apt install git curl build-essential
$ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
$ source $HOME/.cargo/env
$ rustup install 1.79.0
$ mkdir source
$ cd source
$ git clone https://github.com/gtyjiayou666/my_nutria.git
$ cd my_nutria
$ ./jackady update-prebuilts
```
通过百度网盘下载打包好的 gecko-b2g 文件。https://pan.baidu.com/s/1HL9x_oAISv9ImFYAyFEp1w?pwd=gbr7 提取码: gbr7 
```
$ tar -xf b2g-123.0.en-US.linux-x86_64.tar.xz 
$ mv b2g ./prebuilts
$ mv b2g-123.0.en-US.linux-x86_64.tar.xz b2g-123.0.en-US.linux-x86_64.tar.bz2
$ mv b2g-123.0.en-US.linux-x86_64.tar.bz2 .cache #后续镜像打包会用到
```
预览nutria界面
```
$ ./jackady dev
```

---
## 2.2 gecko-b2g
预备安装各种软件包
```
$ cd ~
$ wget https://packages.preprod.kaiostech.com/ndk/v12/mozbuild.tar.bz2
$ tar -xf mozbuild.tar.bz2
$ cd source
$ git clone https://github.com/gtyjiayou666/my_gecko-b2g.git
$ rustup default 1.79.0
$ cargo install cbindgen --version 0.26.0 --force #不要下载最新版本
$ sudo apt install \
    pkg-config \
    libasound2-dev \
    libpulse-dev \
    libx11-dev \
    libpango1.0-dev \
    libx11-xcb-dev \
    libxrandr-dev \
    libxcomposite-dev \
    libxcursor-dev \
    libxdamage-dev \
    libxfixes-dev \
    libxi-dev \
    libxcb-shm0-dev \
    libxext-dev \
    libgtk-3-dev \
    libgtk-3-0 \
    m4 \
    python3-pip
$ rustup default 1.69.0
```
编译gecko-b2g
```
$ bash build_optdesktop.sh -j1
```
将编译好的 gecko-b2g 替换到 nutria 中（只替换了二进制文件，对于 html 等静态文件没有替换）
```
$ bash build_optdesktop_cp.sh
```

# 3 镜像制作

## 3.1 linux x86

### 1. 打包 nutria
```
$ cd my_nutria
$ ./jackady deb
```
builder/output/debian 文件夹下生成 capyloon-desktop_0.3-xxxxx_amd64.deb。
### 2. 下载 cubic
```
$ sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys B7579F80E494ED3406A59DF9081525E2B4F1283B
$ sudo apt-add-repository universe
$ sudo apt-add-repository ppa:cubic-wizard/release
$ sudo apt update
$ sudo apt install --no-install-recommends cubic
```
### 3. 制作新 ISO 镜像
① 新建制作镜像的项目文件夹
```
$ cd ~/source
$ mkdir new_iso
```
打开cubic，选择new_iso文件夹
![](resources/开发指南/assets/镜像制作/1.png)

② 选择准备好的ubuntu-22.04.4-desktop-amd64.iso镜像
![](resources/开发指南/assets/镜像制作/2.png)

③ 对镜像进行修改
![](resources/开发指南/assets/镜像制作/3.png)
将capyloon-desktop_0.3-xxxxx_amd64.deb拖入cubic，复制。
![](resources/开发指南/assets/镜像制作/4.png)
```
# grep -r "universe" /etc/apt/sources.list
# add-apt-repository universe
# apt update
# apt install sway
# apt install ffmpeg
# apt purge snapd
# dpkg -i capyloon-desktop_0.3-20307_amd64.deb
# rm capyloon-desktop_0.3-20307_amd64.deb
# cd /usr/share/xsessions
# mv ubuntu.desktop ubuntu.desktop.back
# vi /etc/gdm3/custom.conf
WaylandEnable = false
```

④ 将不需要的软件取消掉
![](resources/开发指南/assets/镜像制作/5.png)

⑤ 使用默认内核即可
![](resources/开发指南/assets/镜像制作/6.png)

⑥ 选择压缩算法
![](resources/开发指南/assets/镜像制作/7.png)

⑦ 制作出的 ISO 文件在 new_iso 文件夹下
![](resources/开发指南/assets/镜像制作/8.png)

## 3.2 linux arm

由于我们没有 arm 架构的机器，所以无法使用 cubic 制作 arm 架构的镜像(cubic 制作 arm 架构的 ubuntu 镜像必须在arm架构的机器上才行)。但是大概过程是类似的，ubuntu 新发布了 arm 架构的桌面版，所以制作步骤应该与上述类似。可以下载 ubuntu-25.04-desktop-arm64.iso 进行尝试。

我们的代码使用了 xrandr 进行屏幕分辨率、多屏操作，在arm架构下是可以执行的。Capyloon 官方也提供了 mobian 的 deb 文件生成方法。

与 x86 版本不同的地方：
1. gecko-b2g 编译需要的 MOZCONFIG 更改成 mozconfig-b2g-mobian，再进行编译。
2. nutria 编译需要执行 ./jackady update-prebuilts --target aarch64-unknown-linux-gnu，这样才能得到 linux-arm 架构的二进制文件。

## 3.3 gonk

我们在屏幕多分辨率自适应的实现中适配了 android，在编译 gonk 镜像的时候可以编译成功。但是由于需要刷机，我们并没有实测。

具体生成方法是 https://github.com/capyloon/B2G.git 提供的 B2G Generic System Images (B2G-GSI)，这里过程中生成的.mozbuild文件夹可以使用 https://packages.preprod.kaiostech.com/ndk/v10/mozbuild.tar.bz2 。

然后将代码中的 android 的 ndk 版本进行修改 r25b (正常应该只允许使用 r21d)。再使用 rust1.69.0，将代码中的 rust 版本进行修改（正常只允许使用 1.70.0 以上版本）。在编译 B2G 的过程中，将生成的 gecko-b2g 和 nutria 替换成我们的版本即可。

下面是 https://github.com/capyloon/B2G.git 提供的 B2G Generic System Images (B2G-GSI) 截图。
![](resources/开发指南/assets/镜像制作/9.png)

