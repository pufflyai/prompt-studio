import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type {
  LayoutPersistenceAdapter,
  WorkbenchCore,
  WorkbenchHistoryPersistence,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
  WorkbenchPanelMenuRegion,
} from "../../core";
import { createWorkbenchCore } from "../../core";

const LOCATION_KIND = "onboarding.panel-location";
const LOCATION_ID = "onboarding.panel-composition.location";
const RENDERER_ID = "onboarding.panel-composition.renderer";
const panelRegions = ["main", "secondary", "side"] as const;

type CompositionKind =
  | "location-only"
  | "eligible"
  | "open"
  | "menu-only"
  | "collapsed-menu"
  | "sub-panels-menu"
  | "all-panels"
  | "location-switch"
  | "cross-panel-history";

const resources = [
  { kind: LOCATION_KIND, uri: `${LOCATION_KIND}:alpha`, id: "alpha", label: "Alpha location", icon: "Folder" },
  { kind: LOCATION_KIND, uri: `${LOCATION_KIND}:beta`, id: "beta", label: "Beta location", icon: "Folder" },
];

const CompositionContent = (props: { workbench: WorkbenchCore; title: string }) => {
  const { title, workbench } = props;
  return (
    <ScrollArea h="full" bg="bg" contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "md" }}>
      <Stack gap="xs">
        <Text textStyle="title/M/semibold">{title}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Location content owns the breadcrumb. Panel tabs below it are Sub Panels, while attached controls are Panel
          Menus.
        </Text>
      </Stack>
      <HStack gap="sm" wrap="wrap">
        {resources.map((resource) => (
          <Button
            key={resource.id}
            size="sm"
            variant={workbench.getPrimaryResource()?.id === resource.id ? "primary" : "outline"}
            onClick={() => void workbench.resources.openResource(resource, { replaceActive: true })}
          >
            {resource.label}
          </Button>
        ))}
      </HStack>
    </ScrollArea>
  );
};

const SubPanelContent = (props: { title: string }) => {
  const { title } = props;
  return (
    <Stack gap="xs" p="lg">
      <Text textStyle="title/M/semibold">{title}</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        This tab is a Sub Panel owned by the active Location. Its open placement and selection are restored when the
        Location becomes active again.
      </Text>
    </Stack>
  );
};

const PanelMenuContent = (props: { title: string }) => {
  const { title } = props;
  return (
    <Stack gap="xs" p="md">
      <Text textStyle="title/S/semibold">{title}</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        This is the live Panel Menu content. A collapsed menu exposes this same content from its header dropdown.
      </Text>
    </Stack>
  );
};

const menuRegions: WorkbenchPanelMenuRegion[] = ["main-right-menu", "secondary-left-menu", "side-right-menu"];

const panelMenuDefinitions = (kind: CompositionKind) =>
  kind === "location-switch"
    ? [
        {
          id: "onboarding.panel-composition.menu.location-tools",
          title: "Location tools",
          region: "main-left-menu" as const,
          panelMenuOwner: { level: "panel" as const },
        },
        {
          id: "onboarding.panel-composition.menu.notes-tools",
          title: "Notes tools",
          region: "main-right-menu" as const,
          panelMenuOwner: {
            level: "sub-panel" as const,
            contributionId: "onboarding.panel-composition.main.notes",
          },
        },
      ]
    : menuRegions.map((region) => ({
        id: `onboarding.panel-composition.menu.${region}`,
        title: "Inspector",
        region,
        panelMenuOwner: { level: "panel" as const },
      }));

const compositionFlags = (kind: CompositionKind) => ({
  hasEligible: kind !== "location-only" && kind !== "menu-only" && kind !== "collapsed-menu",
  hasMenus: ["menu-only", "collapsed-menu", "sub-panels-menu", "all-panels", "location-switch"].includes(kind),
  openRegions:
    kind === "all-panels" || kind === "cross-panel-history"
      ? panelRegions
      : kind === "open" || kind === "sub-panels-menu" || kind === "location-switch"
        ? (["main"] as const)
        : [],
});

const openPanelCompositionScenario = (
  workbench: Pick<WorkbenchCore, "history" | "layout" | "panels" | "resources">,
  kind: CompositionKind,
) => {
  const flags = compositionFlags(kind);
  void workbench.resources.openResource(resources[0]);
  for (const region of flags.openRegions) {
    workbench.layout.openWidget(`onboarding.panel-composition.${region}.notes`);
  }
  if (kind === "cross-panel-history") {
    for (const region of panelRegions) workbench.layout.openWidget(`onboarding.panel-composition.${region}.reports`);
  }
  const openedMenus = flags.hasMenus
    ? panelMenuDefinitions(kind).map((menu) => workbench.layout.openWidget(menu.id, { pinned: true }))
    : [];
  if (kind === "collapsed-menu") {
    const menu = openedMenus[0];
    if (menu) workbench.panels.setOpen(`panel-menu:${menu.widgetId}`, false);
  }
  if (kind === "location-switch") {
    const locationMenu = openedMenus.find(
      (placement) => placement.contributionId === "onboarding.panel-composition.menu.location-tools",
    );
    if (locationMenu) workbench.panels.setOpen(`panel-menu:${locationMenu.widgetId}`, false);
    void workbench.resources.openResource(resources[1], { replaceActive: true });
    workbench.layout.openWidget("onboarding.panel-composition.main.reports");
    for (const menu of panelMenuDefinitions(kind)) workbench.layout.openWidget(menu.id, { pinned: true });
    workbench.history.goBack();
    workbench.history.goBack();
  }
};

const registerLocationFixture = (ctx: WorkbenchModuleContributionContext, kind: CompositionKind) => {
  ctx.resources.registerKind({ kind: LOCATION_KIND, label: "Location", icon: "Folder", surface: "primary" });
  ctx.resources.registerOpener({
    id: `onboarding.panel-composition.${kind}.opener`,
    canOpen: (resource) => resource.kind === LOCATION_KIND,
    open: (resource, input) => {
      ctx.breadcrumbs.setItems([{ title: resource.label ?? "Location", icon: resource.icon, resource }]);
      return ctx.layout.openWidget(LOCATION_ID, {
        resource,
        title: resource.label,
        replaceActive: input.replaceActive,
      });
    },
  });
  ctx.renderers.registerRenderer({
    id: RENDERER_ID,
    render: ({ placement, workbench }) => {
      const title = placement.title ?? "Panel composition";
      if (placement.role === "panel-menu") return <PanelMenuContent title={title} />;
      if (placement.role === "sub-panel") return <SubPanelContent title={title} />;
      return <CompositionContent workbench={workbench} title={title} />;
    },
  });
  ctx.layout.registerLocation({
    id: LOCATION_ID,
    title: "Location",
    region: "main",
    singleton: false,
    resourceKinds: [LOCATION_KIND],
    rendererId: RENDERER_ID,
  });
};

const registerSubPanelFixtures = (ctx: WorkbenchModuleContributionContext) => {
  for (const region of panelRegions) {
    for (const name of ["Notes", "Reports"]) {
      ctx.layout.registerSubPanel({
        id: `onboarding.panel-composition.${region}.${name.toLowerCase()}`,
        title: name,
        icon: name === "Notes" ? "FileText" : "ChartNoAxesColumn",
        region,
        singleton: true,
        rendererId: RENDERER_ID,
      });
    }
  }
};

const registerPanelMenuFixtures = (ctx: WorkbenchModuleContributionContext, kind: CompositionKind) => {
  for (const menu of panelMenuDefinitions(kind)) {
    ctx.layout.registerPanelMenu({
      id: menu.id,
      title: menu.title,
      icon: "SlidersHorizontal",
      region: menu.region,
      rendererId: RENDERER_ID,
      panelMenuOwner: menu.panelMenuOwner,
    });
  }
};

const createPanelCompositionModule = (kind: CompositionKind, openInitial = true): WorkbenchModuleContribution => ({
  id: `onboarding.panel-composition.${kind}`,
  activate(ctx) {
    const flags = compositionFlags(kind);
    registerLocationFixture(ctx, kind);
    if (flags.hasEligible) registerSubPanelFixtures(ctx);
    if (flags.hasMenus) registerPanelMenuFixtures(ctx, kind);

    if (openInitial) openPanelCompositionScenario(ctx, kind);
  },
});

export const createPanelCompositionWorkbench = (kind: CompositionKind) => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(createPanelCompositionModule(kind));
  if (kind === "all-panels" || kind === "cross-panel-history") workbench.sessionPanel.setMode("attached");
  return workbench;
};

const createMemoryPersistence = () => {
  const histories = new Map<string, Parameters<WorkbenchHistoryPersistence["setHistory"]>[0]>();
  const layouts = new Map<string, Parameters<LayoutPersistenceAdapter["setLayout"]>[0]>();
  return {
    history: {
      getHistory: (scope) => histories.get(scope ?? "global"),
      setHistory: (state, scope) => histories.set(scope ?? "global", state),
    } satisfies WorkbenchHistoryPersistence,
    layout: {
      getLayout: (scope) => layouts.get(scope ?? "global"),
      setLayout: (state, scope) => layouts.set(scope ?? "global", state),
    } satisfies LayoutPersistenceAdapter,
  };
};

export const createRestoredPanelCompositionWorkbench = (afterBack: boolean) => {
  const persistence = createMemoryPersistence();
  const first = createWorkbenchCore({ historyPersistence: persistence.history, layoutPersistence: persistence.layout });
  first.registerModule(createPanelCompositionModule("cross-panel-history", false));
  first.layout.setPersistenceScope("project:alpha");
  first.history.setPersistenceScope("project:alpha");
  openPanelCompositionScenario(first, "cross-panel-history");
  if (afterBack) first.history.goBack();
  first.history.flush();

  const restored = createWorkbenchCore({
    historyPersistence: persistence.history,
    layoutPersistence: persistence.layout,
  });
  restored.registerModule(createPanelCompositionModule("cross-panel-history", false));
  restored.layout.setPersistenceScope("project:alpha");
  restored.history.setPersistenceScope("project:alpha");
  restored.history.restore();
  restored.sessionPanel.setMode("attached");
  return restored;
};

export const createProjectIsolatedPanelCompositionWorkbench = () => {
  const persistence = createMemoryPersistence();
  const workbench = createWorkbenchCore({
    historyPersistence: persistence.history,
    layoutPersistence: persistence.layout,
  });
  workbench.registerModule(createPanelCompositionModule("open", false));
  workbench.layout.setPersistenceScope("project:alpha");
  workbench.history.setPersistenceScope("project:alpha");
  openPanelCompositionScenario(workbench, "open");
  workbench.history.flush();
  workbench.layout.setPersistenceScope("project:beta");
  workbench.history.setPersistenceScope("project:beta");
  void workbench.resources.openResource(resources[1]);
  workbench.layout.openWidget("onboarding.panel-composition.main.reports");
  workbench.history.flush();
  workbench.layout.setPersistenceScope("project:alpha");
  workbench.history.setPersistenceScope("project:alpha");
  workbench.history.restore();
  return workbench;
};
