// Power menu actions.

const kDefaultIdleTimeoutSec = 30;

class ScreenManager {
  constructor() {
    actionsDispatcher.addListener("set-screen-on", () => {
      // console.log(`ScreenManager set-screen-on`);
      document.body.classList.remove("screen-off");
      window.lockscreen.classList.remove("screen-off");
    });

    actionsDispatcher.addListener("set-screen-off", () => {
      // console.log(`ScreenManager set-screen-off`);
      document.body.classList.add("screen-off");
      window.lockscreen.classList.add("screen-off");
      window.lockscreen.lock();
    });
  }
}

class PowerManagerService {
  constructor() {
    this._ready = Promise.reject();

    actionsDispatcher.addListener("set-screen-on", () => {
      this.turnOn();
    });

    actionsDispatcher.addListener("set-screen-off", () => {
      this.turnOff();
    });

    actionsDispatcher.addListener("action-shutdown", () => {
      this.shutDown();
    });

    actionsDispatcher.addListener("action-reboot", () => {
      this.reboot();
    });

    window.addEventListener("devicepickup", () => {
      this.onDevicePickup();
    });

    this.init();
  }

  async onDevicePickup() {
    // Don't do anything if the screen is turned on.
    if (this.isOn) {
      return;
    }

    this.pickupActive = true;

    // Open the wakeup screen then turn screen on.
    let wakeupScreen = document.querySelector("wakeup-screen");
    wakeupScreen.open();

    // Wait enough to prevent showing the lockscreen
    // or homescreen before the wakeup screen.
    // TODO: find a more reliable solution.
    await new Promise((resolve) => {
      window.setTimeout(resolve, 200);
    });

    let screenControlInfo = {
      state: 0, // ScreenState.ON
      brightness: this._currentBrighness || 100,
      external: false,
    };
    await this.service.controlScreen(screenControlInfo);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 3000);
    });

    // Check if we canceled the pickup mode befor the end of the delay.
    if (!this.pickupActive) {
      return;
    }

    // Turn off the screen and hide the wakeup-screen.
    screenControlInfo = {
      state: 1, // ScreenState.OFF
      brightness: 0,
      external: false,
    };
    await this.service.controlScreen(screenControlInfo);
    wakeupScreen.close();
  }

  async cancelPickupIfNeeded() {
    if (!this.pickupActive) {
      return;
    }

    // Turn off the screen and hide the wakeup-screen.
    let screenControlInfo = {
      state: 1, // ScreenState.OFF
      brightness: 0,
      external: false,
    };
    await this.service.controlScreen(screenControlInfo);
    document.querySelector("wakeup-screen").close();
    this.pickupActive = false;
  }

  init() {
    this.locked = false;
    this.isOn = true;
    this.pickupActive = false;

    this._ready = new Promise((resolve, reject) => {
      window.apiDaemon.getPowerManager().then(
        async (service) => {
          this.service = service;
          await this.initBrightness();
          resolve();
        },
        (error) => {
          console.error(`Failed to get PowerManager service: ${error}`);
          reject(error);
        }
      );
    });

    // Listen to battery charging status change events to turn on the screen.
    if (!navigator.getBattery) {
      console.error("navigator.getBattery is not implemented!");
      return;
    }

    // Setup the battery listeners.
    navigator.getBattery().then(
      (battery) => {
        // Set initial state.
        this.isCharging = battery.charging;
        battery.addEventListener("chargingchange", () => {
          this.isCharging = battery.charging;
          actionsDispatcher.dispatch(
            "plugged-status-changed",
            battery.charging
          );
        });
      },
      () => {
        // No battery information available, keep the icon hidden.
        console.error("No battery information available.");
      }
    );
  }

  ready() {
    return this._ready;
  }

  turnOn() {
    this.ready().then(async () => {
      if (this.locked) {
        return;
      }
      this.locked = true;
      let screenControlInfo = {
        state: 0, // ScreenState.ON
        brightness: this._currentBrighness || 100,
        external: false,
      };
      await this.service.controlScreen(screenControlInfo);
      this.locked = false;
      this.isOn = true;
    });
  }

  turnOff() {
    this.ready().then(async () => {
      if (this.locked) {
        return;
      }
      this.locked = true;
      this._currentBrighness = await this.service.screenBrightness;
      let screenControlInfo = {
        state: 1, // ScreenState.OFF
        brightness: 0,
        external: false,
      };
      await this.service.controlScreen(screenControlInfo);
      this.locked = false;
      this.isOn = false;

      // Wake up on any key on desktop.
      if (embedder.sessionType !== "mobile") {
        embedder.addSystemEventListener(
          "keydown",
          function keyWakeUp() {
            actionsDispatcher.dispatch("set-screen-on");
            embedder.removeSystemEventListener("keydown", keyWakeUp, true);
          },
          true
        );
      } else if (!embedder.isGonk()) {
        // Use [Esc] to unlock on desktop mobile emulator.
        embedder.addSystemEventListener(
          "keydown",
          function keyWakeUp(event) {
            if (event.key !== "Escape") {
              return;
            }
            actionsDispatcher.dispatch("set-screen-on");
            embedder.removeSystemEventListener("keydown", keyWakeUp, true);
          },
          true
        );
      }
    });
  }

  showLogo(mode, timeout) {
    let logo = document.getElementById("logo");
    if (!logo) {
      return Promise.resolve();
    } else {
      logo.classList.add(mode);
      logo.classList.remove("hidden");
      return new Promise((resolve) => {
        window.setTimeout(resolve, timeout);
      });
    }
  }

  shutDown() {
    this.ready().then(async () => {
      await this.showLogo("shutdown", 2000);
      this.service.powerOff();
    });
  }

  reboot() {
    this.ready().then(async () => {
      await this.showLogo("reboot", 2000);
      this.service.reboot();
    });
  }

  // Initializes the screen brightness setting for the service.
  async initBrightness() {
    this._settings = await apiDaemon.getSettings();
    try {
      const result = await this._settings.get("display.brightness");
      this._currentBrighness = result.value;
    } catch (e) {}
  }

  set brightness(value) {
    if (this.service) {
      this.service.screenBrightness = value;
      this._settings.set([{ name: "display.brightness", value }]);
    }
  }

  get brightness() {
    return this.service ? this.service.screenBrightness : 0;
  }
}

class PowerManagement {
  constructor() {
    this.screenManager = new ScreenManager();
    this.service = new PowerManagerService();
    this.powerOn = true;
    this.service.turnOn();
    this.powerMenu = document.body.querySelector("reboot-menu");

    // On "desktop" session, don't do on/off or lockscreen management.
    if (embedder.sessionType === "desktop") {
      this.idleCallback = () => {};
    } else {
      this.idleCallback = this.onIdle.bind(this);
    }

    embedder.userIdle.addObserver(this.idleCallback, kDefaultIdleTimeoutSec);

    // Short press turns on/off the screen.
    actionsDispatcher.addListener("power-short-press", async () => {
      // If we are in the power menu, close it.
      if (this.powerMenu.isOpen) {
        this.powerMenu.close();
      }

      await this.service.cancelPickupIfNeeded();

      this.powerOn = !this.powerOn;
      actionsDispatcher.dispatch(
        this.powerOn ? "set-screen-on" : "set-screen-off"
      );
      if (this.powerOn) {
        embedder.userIdle.addObserver(
          this.idleCallback,
          kDefaultIdleTimeoutSec
        );
      }
      // TODO: add embedding support to throttle the system app when the screen is off.
    });

    // Long press open the power menu.
    actionsDispatcher.addListener("power-long-press", () => {
      this.powerMenu.open();
    });

    // Forces the screen to turn on, when plugging or unplugging the device.
    actionsDispatcher.addListener("plugged-status-changed", () => {
      if (!this.powerOn) {
        this.powerOn = true;
        actionsDispatcher.dispatch("set-screen-on");
      }
    });
  }

  // Automatically turn off the screen when idle for too long.
  // TODO: configure with a setting.
  onIdle(topic, duration) {
    if (topic !== "idle") {
      console.error(`Unexpected idle state change: ${topic}`);
      return;
    }

    if (!this.powerOn) {
      return;
    }

    // TODO: use a setting to control this behavior.
    // Don't turn off the screen if the device is plugged in and is not a
    // full screen session.
    if (this.service.isCharging && embedder.sessionType !== "session") {
      return;
    }

    embedder.userIdle.removeObserver(this.idleCallback, kDefaultIdleTimeoutSec);
    this.powerOn = false;
    actionsDispatcher.dispatch("set-screen-off");
  }
}

window.powerManager = new PowerManagement();
