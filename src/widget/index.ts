import { ChatWidget } from "./widget";

function init() {
  const config = (window as { ChatWidget?: { siteId?: string } }).ChatWidget;
  if (!config?.siteId) {
    console.warn("[ALT EGO LABS] window.ChatWidget.siteId is required");
    return;
  }
  new ChatWidget(config.siteId);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
