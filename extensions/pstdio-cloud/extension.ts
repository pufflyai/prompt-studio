import {
  defineExtension,
  defineSettingsPanel,
  defineStatusBarItem,
  defineView,
  l10n,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";

const status = defineView({
  id: "status",
  title: l10n("views.status", "Prompt Studio Cloud"),
  icon: "cloud",
  body: {
    kind: "webview",
    entry: packageAsset("./src/status-view.tsx", import.meta.url),
    capabilities: ["account.read"],
  },
});
const details = defineView({
  id: "details",
  title: l10n("views.details", "Cloud details"),
  icon: "cloud",
  body: {
    kind: "webview",
    entry: packageAsset("./src/details-view.tsx", import.meta.url),
    capabilities: ["account.read", "navigation.open"],
  },
});
const cloudSettings = defineView({
  id: "settings",
  title: l10n("views.settings", "Cloud"),
  icon: "cloud",
  body: {
    kind: "webview",
    entry: packageAsset("./src/settings-view.tsx", import.meta.url),
    capabilities: ["account.read", "account.manage", "navigation.open"],
  },
});

export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  views: [status, details, cloudSettings],
  statusBarItems: [
    defineStatusBarItem({
      id: "cloud",
      view: status.ref,
      popover: details.ref,
      slot: workbenchSlots.statusBarTrailing,
    }),
  ],
  settingsPanels: [defineSettingsPanel({ id: "cloud", view: cloudSettings.ref, slot: workbenchSlots.globalSettings })],
});
