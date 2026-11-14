import {
  defineCommand,
  defineKeybinding,
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  defineResourceKind,
  defineView,
  l10n,
  packageAsset,
  viewDataEvents,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const title = l10n("skills.title", "Skills");
const skill = defineResourceKind({ id: "skill", label: l10n("skill.title", "Skill"), icon: "sparkles" });
const viewer = defineView({
  id: "skill",
  title,
  icon: "sparkles",
  body: {
    kind: "webview",
    entry: packageAsset("./view.tsx", import.meta.url),
    capabilities: ["commands.query"],
  },
});
const main = { kind: "view" as const, view: viewer.ref, cardinality: "one" as const, presentation: "page" as const };
const skills = definePage({
  id: "skills",
  title,
  icon: "sparkles",
  path: "skills",
  mode: workbenchModes.project,
  main,
  slots: [],
});
const detail = definePage({
  id: "skill",
  title: l10n("skill.title", "Skill"),
  icon: "sparkles",
  path: "skill",
  mode: workbenchModes.project,
  parent: skills.ref,
  resource: { kinds: [skill.ref] },
  main,
  slots: [],
});
const list = defineView({
  id: "skill-list",
  title,
  body: {
    kind: "tree",
    searchable: true,
    searchPlaceholder: l10n("skills.search", "Search skills"),
    refreshEvents: [viewDataEvents.extensionCatalogChanged, viewDataEvents.resourcesChanged],
    body: async (ctx) => [
      {
        id: "skills",
        label: title,
        collapsible: false,
        nodes: ((await ctx.skills?.list()) ?? []).map((item) => {
          const resource = {
            type: skill.id,
            id: item.name,
            label: item.title || item.name,
            extensionId: ctx.extensionId,
            projectId: ctx.projectId,
          };
          return {
            id: item.name,
            label: resource.label,
            icon: "sparkles",
            resource,
            target: { kind: "page" as const, page: detail.ref, resource },
          };
        }),
      },
    ],
  },
});
export const commands = {
  list: defineCommand({
    id: "list",
    title: l10n("skills.list", "List skills"),
    cli: true,
    run: async (ctx) => (await ctx.skills?.list()) ?? [],
  }),
  read: defineCommand({
    id: "read",
    title: l10n("skills.read", "Read skill"),
    cli: true,
    params: { name: { type: "text", required: true } },
    run: async (ctx, { name }) => {
      const item = (await ctx.skills?.list())?.find((item) => item.name === name);
      if (!item) throw new Error(`Skill not found: ${name}`);
      return item;
    },
  }),
};
export const browser = {
  resourceKinds: [skill],
  commands: Object.values(commands),
  views: [viewer, list],
  pages: [skills, detail],
  navigationItems: [
    defineNavigationItem({
      id: "skills",
      label: title,
      icon: "sparkles",
      owner: workbenchModes.project,
      slot: "footer",
      action: { kind: "page", page: skills.ref },
    }),
  ],
  navigationTrees: [
    defineNavigationTree({
      id: "skills",
      owner: skills.ref,
      view: list.ref,
      resourceScope: "project",
    }),
  ],
  keybindings: [
    defineKeybinding({
      id: "go-skills",
      layer: "go",
      key: "S",
      sticky: true,
      action: { kind: "page", page: skills.ref },
    }),
  ],
};
