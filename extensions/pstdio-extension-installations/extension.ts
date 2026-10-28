import {
  defineExtension,
  defineStatusBarItem,
  defineView,
  l10n,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";

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
export default defineExtension({
  views: [trigger, details],
  statusBarItems: [
    defineStatusBarItem({
      id: "installations",
      view: trigger.ref,
      popover: details.ref,
      slot: workbenchSlots.statusBarLeading,
    }),
  ],
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
});
