import {
  defineExtension,
  defineSettingsPanel,
  defineSettingsSection,
  defineView,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";

const section = defineSettingsSection({ id: "contract", title: "Host settings", order: 30 });
const view = defineView({
  id: "settings",
  title: "Host settings",
  body: {
    kind: "webview",
    entry: packageAsset("./view.ts", import.meta.url),
    capabilities: ["extension.settings.all", "extension.settings.set"],
  },
});
export default defineExtension({
  settings: { properties: { value: { type: "number", scope: "project", default: 1, title: "Value" } } },
  settingsSections: [section],
  views: [view],
  settingsPanels: [
    defineSettingsPanel({ id: "project", view: view.ref, slot: workbenchSlots.projectSettings, section: section.ref }),
  ],
});
