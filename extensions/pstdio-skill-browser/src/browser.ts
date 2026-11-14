import {
  defineCommand,
  defineKeybinding,
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  defineResourceKind,
  defineView,
  defineViewMenu,
  l10n,
  packageAsset,
  viewDataEvents,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { readSkill, selectedSkillFile, skillFiles, skillInfo } from "./skill-content";

const title = l10n("skills.title", "Skills");
const skill = defineResourceKind({ id: "skill", label: l10n("skill.title", "Skill"), icon: "sparkles" });
const viewer = defineView({
  id: "skill",
  title,
  icon: "sparkles",
  body: {
    kind: "file",
    refreshEvents: [viewDataEvents.extensionCatalogChanged, viewDataEvents.resourcesChanged],
    load: async (ctx, { renderer }) => {
      const item = await readSkill(ctx, renderer.resource?.id);
      const file = item && selectedSkillFile(item, renderer.pageParams?.file);
      if (!file) return { emptyState: { title: "No skill content" } };
      return { fileName: file.path, filePath: file.path, content: file.content, editable: false };
    },
  },
});
const landing = defineView({
  id: "skill-landing",
  title,
  body: {
    kind: "webview",
    entry: packageAsset("./view.tsx", import.meta.url),
    capabilities: ["commands.query", "navigation.open"],
  },
});
const main = { kind: "view" as const, view: viewer.ref, cardinality: "one" as const, presentation: "page" as const };
const skills = definePage({
  id: "skills",
  title,
  icon: "sparkles",
  path: "skills",
  mode: workbenchModes.project,
  main: { ...main, view: landing.ref },
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
  params: { file: { type: "string", default: "SKILL.md" } },
  main,
  slots: [],
});
const details = defineView({
  id: "skill-details",
  title: l10n("skill.details", "Skill details"),
  icon: "info",
  body: {
    kind: "tree",
    defaultExpandedSectionIds: ["info", "files"],
    refreshEvents: [viewDataEvents.extensionCatalogChanged, viewDataEvents.resourcesChanged],
    body: async (ctx, { renderer }) => {
      const item = await readSkill(ctx, renderer.resource?.id);
      if (!item) return [];
      const resource = renderer.resource ?? {
        type: skill.id,
        id: item.name,
        label: item.title,
        extensionId: ctx.extensionId,
        projectId: ctx.projectId,
      };
      const file = selectedSkillFile(item, renderer.pageParams?.file);
      return [
        skillInfo(item),
        {
          id: "files",
          label: l10n("skill.files", "Files"),
          nodes: skillFiles(item, file?.path, (path) => ({
            kind: "page",
            page: detail.ref,
            resource,
            params: { file: path },
          })),
        },
      ];
    },
  },
});
const list = defineView({
  id: "skill-list",
  title,
  body: {
    kind: "tree",
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
    params: { name: { type: "text" } },
    run: async (ctx, { name }) => readSkill(ctx, typeof name === "string" ? name : undefined),
  }),
};
export const browser = {
  resourceKinds: [skill],
  commands: Object.values(commands),
  views: [viewer, landing, list, details],
  pages: [skills, detail],
  viewMenus: [defineViewMenu({ id: "skill-details", owner: viewer.ref, view: details.ref, side: "right" })],
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
