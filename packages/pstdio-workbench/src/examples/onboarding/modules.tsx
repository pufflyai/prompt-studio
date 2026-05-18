import { Button, Code, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import {
  createWorkbenchCore,
  headerTrailingMenuPath,
  type ResourceRef,
  type TreeNode,
  type WorkbenchCore,
  type WorkbenchModuleContribution,
  type WorkbenchModuleContributionContext,
  workbenchCommandPaletteMenuPath,
} from "../../core";
import { useWorkbenchStore } from "../../react";
import { onboardingTreeSections } from "./tree-sections";

const GUIDE_KIND = "onboarding.guide";
const MAIN_PLACEHOLDER_ID = "onboarding.empty-main";
const MAIN_PLACEHOLDER_RENDERER_ID = "onboarding.empty-main.renderer";
const GUIDE_WIDGET_ID = "onboarding.guide.widget";
const GUIDE_RENDERER_ID = "onboarding.guide.renderer";
const OPEN_GUIDE_COMMAND_ID = "onboarding.open-guide";
const DOCS_TREE_ID = "onboarding.docs-tree";
const MODE_SWITCHER_WIDGET_ID = "onboarding.mode-switcher";
const MODE_SWITCHER_RENDERER_ID = "onboarding.mode-switcher.renderer";

const LessonPanel = (props: { title: string; children: ReactNode }) => {
  const { title, children } = props;

  return (
    <Stack h="full" minH="0" p="lg" gap="md" bg="bg">
      <Text textStyle="title/S/semibold">{title}</Text>
      <Stack gap="sm" maxW="720px">
        {children}
      </Stack>
    </Stack>
  );
};

const InlineCode = (props: { children: ReactNode }) => {
  const { children } = props;

  return <Code colorPalette="gray">{children}</Code>;
};

const guides = [
  {
    id: "start",
    label: "Getting started",
    description: "Create the shell, then contribute UI through modules.",
    body: "A resource opener maps this guide resource to the main guide widget.",
  },
  {
    id: "commands",
    label: "Commands",
    description: "Commands can be exposed in menus and the command palette.",
    body: "The workbench stays responsible for command registration and discovery.",
  },
  {
    id: "states",
    label: "States and edges",
    description: "Long labels, empty sections, and many resources should still fit.",
    body: "Use boundary stories to prove the shell remains navigable under real content.",
  },
] as const;

const guideResource = (guide: (typeof guides)[number]): ResourceRef => ({
  kind: GUIDE_KIND,
  uri: `${GUIDE_KIND}:${guide.id}`,
  id: guide.id,
  label: guide.label,
  icon: "FileText",
  metadata: { body: guide.body, description: guide.description },
});

export const createWorkbench = (module?: WorkbenchModuleContribution) => {
  const workbench = createWorkbenchCore();
  if (module) workbench.registerModule(module);
  return workbench;
};

const registerEmptyMain = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerPlaceholder({
    id: MAIN_PLACEHOLDER_ID,
    title: "Empty main",
    area: "main",
    rendererId: MAIN_PLACEHOLDER_RENDERER_ID,
  });
  ctx.renderers.registerRenderer({
    id: MAIN_PLACEHOLDER_RENDERER_ID,
    render: () => (
      <LessonPanel title="Nothing is open">
        <Text textStyle="paragraph/M/regular">
          This is the first useful contribution: a placeholder for the main workbench area.
        </Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Register it with <InlineCode>layout.registerPlaceholder</InlineCode> and a renderer.
        </Text>
      </LessonPanel>
    ),
  });
};

const registerGuideWidget = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget({
    id: GUIDE_WIDGET_ID,
    title: "Guide",
    area: "main",
    closable: true,
    resourceKinds: [GUIDE_KIND],
    rendererId: GUIDE_RENDERER_ID,
  });
  ctx.renderers.registerRenderer({
    id: GUIDE_RENDERER_ID,
    render: ({ placement }) => (
      <LessonPanel title={placement.resource?.label ?? "Guide"}>
        <Text textStyle="paragraph/M/regular">
          {typeof placement.resource?.metadata?.body === "string"
            ? placement.resource.metadata.body
            : "This widget was opened by the module."}
        </Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          The renderer reads the active placement, including the optional resource and tab title.
        </Text>
      </LessonPanel>
    ),
  });
};

const guideTreeNode = (guide: (typeof guides)[number], options: { resourceBacked?: boolean } = {}): TreeNode => {
  const resource = options.resourceBacked ? guideResource(guide) : undefined;

  return {
    id: resource?.uri ?? `${DOCS_TREE_ID}.${guide.id}`,
    label: guide.label,
    description: guide.description,
    icon: "FileText",
    ...(resource ? { resource } : {}),
  };
};

const registerDocsTree = (ctx: WorkbenchModuleContributionContext, options: { resourceBacked?: boolean } = {}) => {
  ctx.renderers.registerTreeRenderer({
    id: DOCS_TREE_ID,
    title: "Docs",
    defaultExpandedSectionIds: ["guides"],
    getBody: () => [
      {
        id: "guides",
        label: "Guides",
        nodes: guides.map((guide) => guideTreeNode(guide, options)),
      },
    ],
    getChildren: () => [],
  });
  ctx.layout.registerWidget({
    id: DOCS_TREE_ID,
    title: "Docs",
    area: "left",
    areaSize: { defaultPx: 260, minPx: 220 },
    rendererId: DOCS_TREE_ID,
  });
  ctx.layout.openWidget(DOCS_TREE_ID);
};

export const createPlaceholderModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.placeholder",
  activate(ctx) {
    registerEmptyMain(ctx);
  },
});

export const createWidgetModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.widget",
  activate(ctx) {
    registerEmptyMain(ctx);
    registerGuideWidget(ctx);
    ctx.layout.openWidget(GUIDE_WIDGET_ID, { title: "First widget" });
  },
});

export const createCommandModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.command",
  activate(ctx) {
    registerEmptyMain(ctx);
    registerGuideWidget(ctx);
    ctx.commands.registerCommand(
      { id: OPEN_GUIDE_COMMAND_ID, label: "Open guide", category: "Onboarding", icon: "Plus" },
      { execute: () => ctx.layout.openWidget(GUIDE_WIDGET_ID, { title: "Opened from command" }) },
    );
    ctx.layout.registerMenuItem(headerTrailingMenuPath("main"), {
      commandId: OPEN_GUIDE_COMMAND_ID,
      group: "primary",
      order: 10,
    });
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: OPEN_GUIDE_COMMAND_ID,
      group: "Onboarding",
      order: 10,
    });
  },
});

export const createTreeViewsModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.tree-views",
  activate(ctx) {
    registerEmptyMain(ctx);
    ctx.renderers.registerTreeRenderer({
      id: DOCS_TREE_ID,
      title: "Docs",
      defaultExpandedSectionIds: ["concepts", "surfaces"],
      getBody: () => onboardingTreeSections,
      getChildren: () => [],
    });
    ctx.layout.registerWidget({
      id: DOCS_TREE_ID,
      title: "Docs",
      area: "left",
      areaSize: { defaultPx: 260, minPx: 220 },
      rendererId: DOCS_TREE_ID,
    });
    ctx.layout.openWidget(DOCS_TREE_ID);
  },
});

export const createResourcesModule = (options: { openFirst?: boolean } = {}): WorkbenchModuleContribution => ({
  id: "onboarding.resources",
  activate(ctx) {
    registerEmptyMain(ctx);
    registerGuideWidget(ctx);
    ctx.resources.registerKind({ kind: GUIDE_KIND, label: "Guide", icon: "BookOpen" });
    ctx.resources.registerOpener({
      id: "onboarding.guide-opener",
      canOpen: (resource) => resource.kind === GUIDE_KIND,
      open: (resource) =>
        ctx.layout.openWidget(GUIDE_WIDGET_ID, {
          resource,
          title: resource.label,
        }),
    });
    registerDocsTree(ctx, { resourceBacked: true });

    if (options.openFirst) void ctx.resources.openResource(guideResource(guides[0]));
  },
});

const ModeSwitcher = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const activeModeId = useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);

  return (
    <Stack h="full" p="xs" gap="xs" bg="bg.subtle" align="center">
      <Button
        aria-label="Docs mode"
        size="xs"
        variant={activeModeId === "docs" ? "solid" : "ghost"}
        onClick={() => workbench.modes.setActiveMode("docs")}
      >
        D
      </Button>
      <Button
        aria-label="Review mode"
        size="xs"
        variant={activeModeId === "review" ? "solid" : "ghost"}
        onClick={() => workbench.modes.setActiveMode("review")}
      >
        R
      </Button>
    </Stack>
  );
};

export const createModesModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.modes",
  activate(ctx) {
    ctx.layout.registerWidget({
      id: MODE_SWITCHER_WIDGET_ID,
      title: "Modes",
      area: "activityBar",
      singleton: true,
      rendererId: MODE_SWITCHER_RENDERER_ID,
    });
    ctx.renderers.registerRenderer({
      id: MODE_SWITCHER_RENDERER_ID,
      render: ({ workbench }) => <ModeSwitcher workbench={workbench} />,
    });
    ctx.modes.registerMode({
      id: "docs",
      label: "Docs",
      activate: createResourcesModule({ openFirst: true }).activate,
    });
    ctx.modes.registerMode({
      id: "review",
      label: "Review",
      activate(modeCtx) {
        registerEmptyMain(modeCtx);
        modeCtx.layout.registerWidget({
          id: "onboarding.review.widget",
          title: "Review queue",
          area: "main",
          singleton: true,
          rendererId: "onboarding.review.renderer",
        });
        modeCtx.renderers.registerRenderer({
          id: "onboarding.review.renderer",
          render: () => (
            <LessonPanel title="Review mode">
              <Text textStyle="paragraph/M/regular">
                Modes own temporary contributions. Switching back to Docs disposes this widget and restores the docs
                tree.
              </Text>
            </LessonPanel>
          ),
        });
        modeCtx.layout.openWidget("onboarding.review.widget");
      },
    });
    ctx.layout.openWidget(MODE_SWITCHER_WIDGET_ID, { pinned: true });
    ctx.modes.setActiveMode("docs");
  },
});
