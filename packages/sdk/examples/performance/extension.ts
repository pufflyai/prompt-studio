import { defineExtension, defineSettingsPanel, defineView, packageAsset, workbenchSlots } from "@pstdio/sdk/extensions";

const settings = defineView({
  id: "performance-settings",
  title: "Performance consumer",
  body: {
    kind: "webview",
    entry: packageAsset("./view.tsx", import.meta.url),
    capabilities: ["performance.read", "performance.control"],
  },
});

export default defineExtension({
  views: [settings],
  settingsPanels: [
    defineSettingsPanel({ id: "performance", view: settings.ref, slot: workbenchSlots.developerSettings }),
  ],
});
