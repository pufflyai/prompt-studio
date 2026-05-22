export const onboardingSources = {
  emptyWorkbench: `import { createWorkbenchCore } from "pstdio-workbench/core";
import { Workbench } from "pstdio-workbench/react";

const workbench = createWorkbenchCore();

export const EmptyWorkbench = () => <Workbench workbench={workbench} />;`,

  placeholder: `import type { WorkbenchModuleContribution } from "pstdio-workbench/core";

const EMPTY_MAIN_RENDERER_ID = "docs.empty-main.renderer";

export const createPlaceholderModule = (): WorkbenchModuleContribution => ({
  id: "docs.placeholder",
  activate(ctx) {
    ctx.layout.registerPlaceholder({
      id: "docs.empty-main",
      title: "Empty main",
      area: "main",
      rendererId: EMPTY_MAIN_RENDERER_ID,
    });

    ctx.renderers.registerRenderer({
      id: EMPTY_MAIN_RENDERER_ID,
      render: () => (
        <div>
          <h2>Nothing is open</h2>
          <p>Open a widget to start working.</p>
        </div>
      ),
    });
  },
});`,

  rendererAndWidget: `import type { WorkbenchModuleContribution } from "pstdio-workbench/core";

const GUIDE_WIDGET_ID = "docs.guide";
const GUIDE_RENDERER_ID = "docs.guide.renderer";

export const createGuideModule = (): WorkbenchModuleContribution => ({
  id: "docs.guide-module",
  activate(ctx) {
    ctx.layout.registerWidget({
      id: GUIDE_WIDGET_ID,
      title: "Guide",
      area: "main",
      closable: true,
      rendererId: GUIDE_RENDERER_ID,
    });

    ctx.renderers.registerRenderer({
      id: GUIDE_RENDERER_ID,
      render: ({ placement }) => (
        <article>
          <h2>{placement.title ?? "Guide"}</h2>
          <p>This widget was opened by the module.</p>
        </article>
      ),
    });

    ctx.layout.openWidget(GUIDE_WIDGET_ID, { title: "First widget" });
  },
});`,

  commandAndMenu: `import {
  headerTrailingMenuPath,
  workbenchCommandPaletteMenuPath,
  type WorkbenchModuleContribution,
} from "pstdio-workbench/core";

const GUIDE_WIDGET_ID = "docs.guide";
const OPEN_GUIDE_COMMAND_ID = "docs.open-guide";

export const createCommandModule = (): WorkbenchModuleContribution => ({
  id: "docs.commands",
  activate(ctx) {
    ctx.commands.registerCommand(
      {
        id: OPEN_GUIDE_COMMAND_ID,
        label: "Open guide",
        category: "Docs",
        icon: "Plus",
      },
      {
        execute: () =>
          ctx.layout.openWidget(GUIDE_WIDGET_ID, {
            title: "Opened from command",
          }),
      },
    );

    ctx.layout.registerMenuItem(headerTrailingMenuPath("main"), {
      commandId: OPEN_GUIDE_COMMAND_ID,
      group: "primary",
      order: 10,
    });

    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: OPEN_GUIDE_COMMAND_ID,
      group: "Docs",
      order: 10,
    });
  },
});`,

  treeViews: `import type { TreeNode, WorkbenchModuleContribution } from "pstdio-workbench/core";

export const createTreeViewsModule = (): WorkbenchModuleContribution => ({
  id: "docs.tree-views",
  activate(ctx) {
    ctx.renderers.registerTreeRenderer({
      id: "docs.tree",
      title: "Docs",
      defaultExpandedSectionIds: ["concepts", "surfaces"],
      getBody: () => [
        {
          id: "concepts",
          label: "Concepts",
          nodes: [
            {
              id: "areas",
              label: "Areas",
              description: "Named layout targets for contributed UI.",
              icon: "PanelLeft",
              children: [
                { id: "areas.main", label: "main", icon: "PanelTop" },
                { id: "areas.left", label: "left", icon: "PanelLeft" },
                { id: "areas.status", label: "status", icon: "PanelBottom" },
              ],
            },
            {
              id: "widgets",
              label: "Widgets",
              description: "Registered views that can be placed into areas.",
              icon: "PanelsTopLeft",
              children: [
                { id: "widgets.renderer", label: "rendererId", icon: "Code" },
                {
                  id: "widgets.singleton",
                  label: "singleton",
                  description: "One placement total for durable tool views.",
                  icon: "Pin",
                },
                {
                  id: "widgets.reuse",
                  label: "reuse",
                  description: "Reopen resource tabs or opt into duplicate placements.",
                  icon: "RefreshCw",
                },
              ],
            },
          ],
        },
        {
          id: "surfaces",
          label: "Surfaces",
          nodes: [
            { id: "menus", label: "Menus", icon: "ListTree" },
            { id: "commands", label: "Commands", icon: "Terminal" },
          ],
        },
      ],
      getChildren: () => [],
    });
    ctx.layout.registerWidget({
      id: "docs.tree",
      title: "Docs",
      area: "left",
      areaSize: { defaultPx: 260, minPx: 220 },
      rendererId: "docs.tree",
    });
    ctx.layout.openWidget("docs.tree");
  },
});`,

  resources: `import type {
  ResourceRef,
  TreeNode,
  WorkbenchModuleContribution,
} from "pstdio-workbench/core";

const GUIDE_KIND = "docs.guide";
const GUIDE_WIDGET_ID = "docs.guide";
const GUIDE_RENDERER_ID = "docs.guide.renderer";

const guides = [
  { id: "start", label: "Getting started" },
  { id: "commands", label: "Commands" },
];

const guideResource = (guide: (typeof guides)[number]): ResourceRef => ({
  kind: GUIDE_KIND,
  uri: \`\${GUIDE_KIND}:\${guide.id}\`,
  id: guide.id,
  label: guide.label,
});

export const createResourcesModule = (): WorkbenchModuleContribution => ({
  id: "docs.resources",
  activate(ctx) {
    ctx.layout.registerWidget({
      id: GUIDE_WIDGET_ID,
      title: "Guide",
      area: "main",
      closable: true,
      rendererId: GUIDE_RENDERER_ID,
      resourceKinds: [GUIDE_KIND],
    });

    ctx.renderers.registerRenderer({
      id: GUIDE_RENDERER_ID,
      render: ({ placement }) => (
        <article>
          <h2>{placement.resource?.label ?? "Guide"}</h2>
        </article>
      ),
    });

    ctx.resources.registerKind({
      kind: GUIDE_KIND,
      label: "Guide",
      icon: "BookOpen",
    });

    ctx.resources.registerOpener({
      id: "docs.guide-opener",
      canOpen: (resource) => resource.kind === GUIDE_KIND,
      open: (resource) =>
        ctx.layout.openWidget(GUIDE_WIDGET_ID, {
          resource,
          title: resource.label,
        }),
    });

    ctx.renderers.registerTreeRenderer({
      id: "docs.tree",
      title: "Docs",
      defaultExpandedSectionIds: ["guides"],
      getBody: () => [
        {
          id: "guides",
          label: "Guides",
          nodes: guides.map((guide): TreeNode => {
            const resource = guideResource(guide);
            return {
              id: resource.uri,
              label: guide.label,
              icon: "FileText",
              resource,
            };
          }),
        },
      ],
      getChildren: () => [],
    });
    ctx.layout.registerWidget({
      id: "docs.tree",
      title: "Docs",
      area: "left",
      rendererId: "docs.tree",
    });
    ctx.layout.openWidget("docs.tree");

    void ctx.resources.openResource(guideResource(guides[0]));
  },
});`,

  modes: `import type { WorkbenchModuleContribution } from "pstdio-workbench/core";

export const createModesModule = (): WorkbenchModuleContribution => ({
  id: "docs.modes",
  activate(ctx) {
    ctx.modes.registerMode({
      id: "docs",
      label: "Docs",
      activate(modeCtx) {
        modeCtx.renderers.registerTreeRenderer({
          id: "docs.tree",
          title: "Docs",
          getBody: () => [{ id: "guides", nodes: [] }],
          getChildren: () => [],
        });
        modeCtx.layout.registerWidget({
          id: "docs.tree",
          title: "Docs",
          area: "left",
          rendererId: "docs.tree",
        });
        modeCtx.layout.openWidget("docs.tree");
      },
    });

    ctx.modes.registerMode({
      id: "review",
      label: "Review",
      activate(modeCtx) {
        modeCtx.layout.registerWidget({
          id: "docs.review",
          title: "Review queue",
          area: "main",
          singleton: true,
          rendererId: "docs.review.renderer",
        });
      },
    });

    ctx.modes.setActiveMode("docs");
  },
});`,

  commandsKeybindingsThemes: `import type { WorkbenchModuleContribution } from "pstdio-workbench/core";

const OPEN_THEME_COMMAND_ID = "docs.open-theme";

export const createCommandKeybindingThemeModule = (): WorkbenchModuleContribution => ({
  id: "docs.commands-keybindings-themes",
  activate(ctx) {
    ctx.commands.registerCommand(
      { id: OPEN_THEME_COMMAND_ID, label: "Open theme picker", category: "Docs", icon: "Palette" },
      { execute: () => ctx.commands.executeCommand("workbench.action.changeTheme") },
    );

    ctx.keybindings.registerKeybinding({
      commandId: OPEN_THEME_COMMAND_ID,
      keybinding: "ctrl+shift+y",
      when: "!inputFocus",
    });
  },
});`,
} as const;
