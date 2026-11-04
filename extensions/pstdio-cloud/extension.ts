import {
  defineExtension,
  defineNavigationItem,
  definePage,
  defineSettingsPanel,
  defineView,
  l10n,
  packageAsset,
  workbenchModes,
  workbenchSlots,
} from "@pstdio/sdk/extensions";

const view = defineView({
  id: "devices",
  title: l10n("devices", "Devices"),
  icon: "monitor",
  body: {
    kind: "webview",
    entry: packageAsset("./src/devices-view.tsx", import.meta.url),
    capabilities: ["account.read", "account.manage", "navigation.open"],
  },
});
const page = definePage({
  id: "devices",
  title: l10n("devices", "Devices"),
  icon: "monitor",
  path: "devices",
  mode: workbenchModes.project,
  main: { kind: "view", view: view.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  views: [view],
  pages: [page],
  settingsPanels: [defineSettingsPanel({ id: "devices", view: view.ref, slot: workbenchSlots.globalSettings })],
  navigationItems: [
    defineNavigationItem({
      id: "devices",
      label: l10n("devices", "Devices"),
      icon: "monitor",
      owner: workbenchModes.project,
      slot: "content",
      action: { kind: "page", page: page.ref },
    }),
  ],
});
