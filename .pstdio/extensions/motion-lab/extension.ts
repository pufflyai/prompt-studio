import { studies } from "@pstdio/motion-studies";
import {
  defineCommandPaletteResource,
  defineExtension,
  defineNavigationItem,
  definePage,
  defineResourceKind,
  defineView,
  defineViewMenu,
  l10n,
  type NavigationTarget,
  packageAsset,
  type ResourceRef,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";

const animation = defineResourceKind({ id: "motion-lab.animation", label: "Animation", icon: "film" });

const resource = (id: string, projectId?: string) =>
  ({
    type: animation.ref.id,
    id,
    label: studies.find((study) => study.id === id)?.title,
    extensionId: "pstdio.motion-lab",
    projectId,
  }) satisfies ResourceRef;

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

const target = (id: string, projectId?: string) =>
  ({
    kind: "page",
    page: page.ref,
    resource: resource(id, projectId),
  }) satisfies NavigationTarget;

const files = defineView({
  id: "animations",
  title: "Animations",
  icon: "folder",
  body: {
    kind: "tree",
    defaultExpandedNodeIds: ["chat", "workbench"],
    body: (_ctx, input) => [
      {
        id: "animations",
        collapsible: false,
        nodes: [
          { id: "chat", label: "Chat", ids: ["chat-turn", "loaders", "streaming", "tools-queue"] },
          { id: "workbench", label: "Workbench", ids: ["panels", "surfaces", "rows", "tabs", "navigation-tree"] },
        ].map((folder) => ({
          id: folder.id,
          label: folder.label,
          icon: "folder",
          collapsible: true,
          children: studies
            .filter((study) => folder.ids.includes(study.id))
            .map((study) => ({
              id: study.id,
              label: study.title,
              icon: "film",
              resource: resource(study.id, input.renderer.projectId),
              target: target(study.id, input.renderer.projectId),
              selected: input.renderer.resource?.id === study.id,
            })),
        })),
      },
    ],
  },
});

const palette = defineCommandPaletteResource({
  id: "animations",
  title: "Motion Lab animations",
  resourceKind: animation.ref,
  query: (_ctx, input) => ({
    items: studies
      .filter((study) =>
        `${study.title} ${study.description} motion lab animation`.toLowerCase().includes(input.query.toLowerCase()),
      )
      .slice(0, input.limit)
      .map((study) => ({
        id: study.id,
        label: study.title,
        icon: "film",
        keywords: ["motion", "animation", "study", study.id],
        target: target(study.id, input.projectId),
      })),
  }),
});

export default defineExtension({
  commands: Object.values(commands),
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
      group: "Tools",
      label: l10n("motionLab.title", "Motion Lab"),
      icon: "play",
      action: target("chat-turn"),
    }),
  ],
});
