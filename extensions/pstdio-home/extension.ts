import {
  defineExtension,
  defineKeybinding,
  defineNavigationItem,
  definePage,
  defineView,
  l10n,
  type PageMainView,
  packageAsset,
  sessionBrowser,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";

const view = defineView({
  id: "home",
  title: l10n("home.title", "Home"),
  body: {
    kind: "webview",
    entry: packageAsset("./src/view.tsx", import.meta.url),
    capabilities: ["commands.query", "commands.execute", "navigation.open"],
  },
});
const withRecentResources = {
  kind: "view",
  view: sessionBrowser.views.conversation,
  intro: view.ref,
  cardinality: "one",
  presentation: "page",
} as const;
// The published SDK accepts the standalone view shape. Newer hosts also render the intro.
const mainView: PageMainView = withRecentResources;
export const home = definePage({
  id: "home",
  title: l10n("home.title", "Home"),
  icon: "house",
  path: "home",
  mode: workbenchModes.project,
  main: mainView,
  slots: [],
});
const target = { kind: "page" as const, page: home.ref };
export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  commands: Object.values(commands),
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
