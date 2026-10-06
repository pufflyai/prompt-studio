import { defineExtension, type ViewContribution } from "@pstdio/sdk/extensions";
import boombox from "./src/examples/boombox";
import kiln from "./src/examples/kiln";
import pigeon from "./src/examples/pigeon";
import scribble from "./src/examples/scribble";
import zipline from "./src/examples/zipline";
import { commands } from "./src/state-commands";

const examples = [scribble, boombox, zipline, pigeon, kiln];
export default defineExtension({
  defaultLocale: "en",
  commands: Object.values(commands),
  modes: examples.flatMap((example) => example.modes),
  placements: [...boombox.placements, ...kiln.placements],
  themes: examples.flatMap((example) => example.themes),
  resourceKinds: examples.flatMap((example) => example.resourceKinds),
  views: examples.flatMap<ViewContribution>((example) => example.views),
  pages: examples.flatMap((example) => example.pages),
  navigationItems: examples.flatMap((example) => example.navigationItems),
});
