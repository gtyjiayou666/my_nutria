function postActivityResult(result) {
  const iframeSwProxy = window.document.getElementById("sw-proxy");
  const proxySrc = iframeSwProxy.src;
  iframeSwProxy.contentWindow.postMessage(
    { type: "activity-result", ...result },
    proxySrc
  );
}

window.addEventListener("serviceworkermessage", ({ detail }) => {
  const { category, type, data } = detail;
  if (category === "systemmessage" && type === "activity") {
    const { activityId, source } = data;
    switch (source.name) {
      case "publish-resource":
        actionsDispatcher.dispatch("publish-resource", source.data.id);
        break;
      case "publish-to-ipfs":
        actionsDispatcher.dispatch("publish-to-ipfs", source.data);
        break;
      case "install-tile":
        registerTile(source.data.manifestUrl).then((activityResult) => {
          postActivityResult({ activityId, activityResult });
        });
        break;
      case "open-about":
        let url = source.data.url.toLowerCase();
        if (url.startsWith("about:")) {
          window.wm.openAbout(url);
        } else {
          console.error(`Invalid about: url: ${url}`);
        }
        break;
      default:
        console.error(`Unexpected system app activity name: ${source.name}`);
        break;
    }
  }
});
