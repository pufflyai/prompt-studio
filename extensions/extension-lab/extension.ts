import {
  defineExtension,
  defineNavigationItem,
  definePage,
  l10n,
  type ViewContribution,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { webview } from "./src/definition";
import boombox from "./src/examples/boombox";
import kiln from "./src/examples/kiln";
import pigeon from "./src/examples/pigeon";
import scribble from "./src/examples/scribble";
import zipline from "./src/examples/zipline";
import { commands } from "./src/state-commands";

const examples = [scribble, boombox, zipline, pigeon, kiln];
const faulty = webview("faulty-main", "Lab (faulty)");
const faultyPage = definePage({
  id: "faulty",
  title: l10n("pages.faulty", "Lab (faulty)"),
  icon: "flask-conical-off",
  path: "lab-faulty",
  mode: workbenchModes.project,
  main: {
    kind: "view",
    view: faulty.ref,
    cardinality: "one",
  },
  slots: [],
});
export default defineExtension({
  defaultLocale: "en",
  commands: Object.values(commands),
  modes: examples.flatMap((example) => example.modes),
  placements: [...boombox.placements, ...kiln.placements],
  themes: examples.flatMap((example) => example.themes),
  resourceKinds: examples.flatMap((example) => example.resourceKinds),
  views: [...examples.flatMap<ViewContribution>((example) => example.views), faulty],
  pages: [...examples.flatMap((example) => example.pages), faultyPage],
  navigationItems: [
    ...examples.flatMap((example) => example.navigationItems),
    defineNavigationItem({
      id: "faulty",
      label: l10n("navigation.faulty", "Lab (faulty)"),
      icon: "flask-conical-off",
      owner: workbenchModes.project,
      group: "Examples",
      action: { kind: "page", page: faultyPage.ref },
    }),
  ],
});
