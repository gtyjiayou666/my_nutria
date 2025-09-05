"use strict";
/* global clients */

const SYSTEM_MESSAGE_TYPES = ["activity"];

const HAS_RETURN_VALUE_ACTIVITIES = ["install-tile"];

let messageCache = [];
self.addEventListener("install", (evt) => {
  evt.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(self.clients.claim());
});

function postMessage(evt, message) {
  evt.waitUntil(
    clients
      .matchAll({
        includeUncontrolled: true,
        type: "window",
      })
      .then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage(message);
        });
      })
  );
}

self.onsystemmessage = (evt) => {
  if (SYSTEM_MESSAGE_TYPES.includes(evt.name)) {
    if (!self.systemReady && evt.name === "icc-stkcommand") {
      messageCache.push(evt);
      return;
    }

    if (evt.name === "activity") {
      const handler = evt.data.webActivityRequestHandler();
      const source = handler.source;

      let hasReturn = HAS_RETURN_VALUE_ACTIVITIES.includes(source.name);

      if (hasReturn) {
        evt.waitUntil(handler.postDone());
        let activityId = ActivityRequests.addHandler(handler);
        const data = { source: handler.source, activityId };
        postMessage(evt, {
          category: "systemmessage",
          type: evt.name,
          data,
        });
      } else {
        const data = { source: handler.source };
        postMessage(evt, {
          category: "systemmessage",
          type: evt.name,
          data,
        });
      }
    } else {
      const data = evt.data.json();
      postMessage(evt, {
        category: "systemmessage",
        type: evt.name,
        data,
      });
    }
  }
};

self.addEventListener("message", (event) => {
  // Message received from clients
  const { data } = event;

  if (data.isKeepalive) {
    return;
  }

  if (data.systemReady) {
    self.systemReady = true;
    messageCache.forEach((evt) => {
      postMessage(evt, {
        category: "systemmessage",
        type: evt.name,
        data: evt.data.json(),
      });
    });
    messageCache = [];
  }

  if (data.activityId) {
    const handler = ActivityRequests.getHandler(data.activityId);
    if (data.isError) {
      handler.postError(data.activityResult);
    } else {
      handler.postResult(data.activityResult);
    }
    ActivityRequests.removeHandler(data.activityId);
  }

  if (data.notification) {
    try {
      let notification = data.notification;
      let { title, body, icon, tag, actions } = notification;
      let ndata = notification.data;
      self.registration
        .showNotification(title, {
          body,
          icon,
          tag,
          actions,
          data: ndata,
        })
        .catch((e) => {
          console.log(`SW showNotification error: ${e}`);
        });

      self.onnotificationclick = (event) => {
        // Send back the notification click action.
        postMessage(event, {
          category: "notification",
          type: "action",
          data: { action: event.action, tag: event.notification.tag },
        });
      };
    } catch (e) {
      console.error(`SW Oops: ${e}`);
    }
  }
});

const ActivityRequests = {
  map: new Map(),

  addHandler(handler) {
    const activityId = `${+new Date()}`;
    this.map.set(activityId, handler);
    return activityId;
  },

  removeHandler(id) {
    this.map.delete(id);
  },

  getHandler(id) {
    return this.map.get(id);
  },

  get size() {
    return this.map.size;
  },
};
