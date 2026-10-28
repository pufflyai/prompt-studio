import {
  defineExtension,
  defineSettingsPanel,
  defineStatusBarItem,
  defineView,
  l10n,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { visibilitySetting } from "./src/settings";

const title = l10n("installations.title", "Installing Extensions");
const trigger = defineView({
  id: "status",
  title,
  icon: "Puzzle",
  body: {
    kind: "webview",
    entry: packageAsset("./src/status-entry.tsx", import.meta.url),
    capabilities: ["extensions.installations.read"],
  },
});
const details = defineView({
  id: "details",
  title,
  body: {
    kind: "webview",
    entry: packageAsset("./src/details-entry.tsx", import.meta.url),
    capabilities: ["extensions.installations.read", "extensions.installations.retry", "navigation.open"],
  },
});
const settings = defineView({
  id: "settings",
  title,
  body: {
    kind: "webview",
    entry: packageAsset("./src/settings-entry.tsx", import.meta.url),
    capabilities: ["preferences.get", "preferences.set"],
  },
});
export default defineExtension({
  views: [trigger, details, settings],
  settings: { properties: { [visibilitySetting]: { type: "boolean", scope: "global", default: true, title } } },
  settingsPanels: [defineSettingsPanel({ id: "settings", view: settings.ref, slot: workbenchSlots.developerSettings })],
  statusBarItems: [
    defineStatusBarItem({
      id: "installations",
      view: trigger.ref,
      popover: details.ref,
      slot: workbenchSlots.statusBarLeading,
      visibilitySetting,
    }),
  ],
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
});
