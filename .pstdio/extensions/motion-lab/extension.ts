import {
  defineExtension,
  defineHook,
  defineNavigationItem,
  definePage,
  defineSkill,
  defineView,
  defineViewMenu,
  l10n,
  packageAsset,
  sessionEvents,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";
import { files, palette } from "./src/study-contributions";
import { studiesChanged } from "./src/study-events";
import { animation, target } from "./src/study-navigation";

const preview = defineView({
  id: "preview",
  title: "Preview",
  icon: "play",
  body: { kind: "webview", entry: packageAsset("./src/main.tsx", import.meta.url), capabilities: ["commands.execute"] },
});

const parameters = defineView({
  id: "parameters",
  title: "Params",
  icon: "settings-2",
  body: {
    kind: "webview",
    entry: packageAsset("./src/params-entry.tsx", import.meta.url),
    capabilities: ["commands.execute"],
  },
});

const home = definePage({
  id: "motion-lab",
  title: "Motion Lab",
  path: "motion-lab",
  mode: workbenchModes.project,
  main: { kind: "view", view: preview.ref, cardinality: "one" },
  slots: [],
});

const page = definePage({
  id: "animation",
  title: "Motion Lab",
  path: "motion-lab/animation",
  mode: workbenchModes.project,
  parent: home.ref,
  resource: { kinds: [animation.ref] },
  main: { kind: "view", view: preview.ref, cardinality: "one" },
  slots: [],
});

export default defineExtension({
  commands: Object.values(commands),
  hooks: [
    defineHook({
      id: "studies-after-turn",
      event: sessionEvents.awaitingInput,
      run: async (ctx) => {
        await ctx.events.emit(studiesChanged, {});
      },
    }),
    defineHook({
      id: "studies-after-success",
      event: sessionEvents.succeeded,
      run: async (ctx) => {
        await ctx.events.emit(studiesChanged, {});
      },
    }),
    defineHook({
      id: "studies-after-failure",
      event: sessionEvents.failed,
      run: async (ctx) => {
        await ctx.events.emit(studiesChanged, {});
      },
    }),
  ],
  skills: [
    defineSkill({
      id: "motion-lab",
      title: "Motion Lab studies",
      source: packageAsset("./skills/motion-lab", import.meta.url),
    }),
  ],
  resourceKinds: [animation],
  views: [preview, files, parameters],
  pages: [home, page],
  viewMenus: [
    defineViewMenu({ id: "animations", owner: preview.ref, view: files.ref, side: "left" }),
    defineViewMenu({ id: "parameters", owner: preview.ref, view: parameters.ref, side: "right" }),
  ],
  commandPaletteResources: [palette],
  navigationItems: [
    defineNavigationItem({
      id: "motion-lab",
      owner: workbenchModes.project,
      slot: "content",
      label: l10n("motionLab.title", "Motion Lab"),
      icon: "play",
      action: target("chat-turn"),
    }),
  ],
});
