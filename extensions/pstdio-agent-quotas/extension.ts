import {
  defineExtension,
  defineStatusBarItem,
  defineView,
  l10n,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";

const meter = defineView({
  id: "meter",
  title: l10n("views.meter", "Agent quotas"),
  icon: "hourglass",
  body: {
    kind: "webview",
    entry: packageAsset("./src/meter-view.tsx", import.meta.url),
    capabilities: ["commands.execute", "commands.query"],
  },
});

const details = defineView({
  id: "details",
  title: l10n("views.details", "Agent quotas"),
  icon: "hourglass",
  body: {
    kind: "webview",
    entry: packageAsset("./src/details-view.tsx", import.meta.url),
    capabilities: ["commands.execute", "commands.query"],
  },
});

export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  views: [meter, details],
  commands: Object.values(commands),
  statusBarItems: [
    defineStatusBarItem({
      id: "agent-quotas",
      view: meter.ref,
      popover: details.ref,
      slot: workbenchSlots.statusBarTrailing,
    }),
  ],
});
