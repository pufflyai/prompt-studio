import { defineExtension, defineKeybinding, type PageContribution, type ViewContribution } from "@pstdio/sdk/extensions";
import { marmaladeCommands } from "./src/apps/marmalade/marmalade-commands";
import boombox from "./src/examples/boombox";
import kiln from "./src/examples/kiln";
import marmalade from "./src/examples/marmalade";
import pigeon from "./src/examples/pigeon";
import scribble from "./src/examples/scribble";
import zipline from "./src/examples/zipline";
import { commands } from "./src/state-commands";

const examples = [scribble, boombox, zipline, pigeon, kiln, marmalade];
export default defineExtension({
  defaultLocale: "en",
  commands: [...Object.values(commands), ...Object.values(marmaladeCommands)],
  statusBarItems: [...scribble.statusBarItems, ...zipline.statusBarItems, ...kiln.statusBarItems],
  modes: examples.flatMap((example) => example.modes),
  placements: [...boombox.placements, ...kiln.placements],
  themes: examples.flatMap((example) => example.themes),
  resourceKinds: examples.flatMap((example) => example.resourceKinds),
  views: examples.flatMap<ViewContribution>((example) => example.views),
  pages: examples.flatMap<PageContribution>((example) => example.pages),
  keybindings: examples.flatMap((example, index) =>
    example.pages.slice(0, 1).map((page) =>
      defineKeybinding({
        id: `keyboard-example-${index}`,
        layer: "go",
        key: page.ref.id[0]!.toUpperCase(),
        sticky: true,
        action: { kind: "page", page: page.ref },
      }),
    ),
  ),
  navigationItems: examples.flatMap((example) => example.navigationItems),
});
