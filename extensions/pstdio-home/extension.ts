import {
  defineExtension,
  defineKeybinding,
  defineNavigationItem,
  definePage,
  defineSchedule,
  defineView,
  l10n,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";

const view = defineView({
  id: "home",
  title: l10n("home.title", "Home"),
  body: {
    kind: "webview",
    entry: packageAsset("./src/view.tsx", import.meta.url),
    capabilities: ["commands.execute", "commands.query", "navigation.open"],
  },
});
export const home = definePage({
  id: "home",
  title: l10n("home.title", "Home"),
  icon: "house",
  path: "home",
  mode: workbenchModes.project,
  main: { kind: "view", view: view.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
const target = { kind: "page" as const, page: home.ref };
export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  commands: Object.values(commands),
  schedules: [
    defineSchedule({
      id: "quota-history",
      title: l10n("quotas.schedule", "Record quota history"),
      schedule: "0 * * * *",
      command: commands.quotas.ref,
    }),
  ],
  views: [view],
  pages: [home],
  navigationItems: [
    defineNavigationItem({
      id: "home",
      label: l10n("home.title", "Home"),
      icon: "house",
      owner: workbenchModes.project,
      slot: "header",
      action: target,
    }),
  ],
  keybindings: [defineKeybinding({ id: "go-home", layer: "go", key: "H", sticky: true, action: target })],
});
