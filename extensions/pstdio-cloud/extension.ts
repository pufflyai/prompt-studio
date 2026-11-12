import {
  defineExtension,
  defineSettingsPanel,
  defineStatusBarItem,
  defineView,
  l10n,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { cloudCommands } from "./src/project-state";

const status = defineView({
  id: "status",
  title: l10n("views.status", "Prompt Studio Cloud"),
  icon: "cloud",
  body: {
    kind: "webview",
    entry: packageAsset("./src/status-view.tsx", import.meta.url),
    capabilities: ["account.read", "commands.execute", "commands.query"],
  },
});
const details = defineView({
  id: "details",
  title: l10n("views.details", "Cloud details"),
  icon: "cloud",
  body: {
    kind: "webview",
    entry: packageAsset("./src/details-view.tsx", import.meta.url),
    capabilities: ["account.read", "navigation.open", "commands.execute", "commands.query"],
  },
});
const cloudSettings = defineView({
  id: "settings",
  title: l10n("views.settings", "Cloud"),
  icon: "cloud",
  body: {
    kind: "webview",
    entry: packageAsset("./src/settings-view.tsx", import.meta.url),
    capabilities: ["account.read", "account.manage", "navigation.open", "commands.execute", "commands.query"],
  },
});

export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  views: [status, details, cloudSettings],
  commands: Object.values(cloudCommands),
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
