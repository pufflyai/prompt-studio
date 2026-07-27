import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type {
  LayoutPersistenceAdapter,
  WorkbenchCore,
  WorkbenchHistoryPersistence,
  WorkbenchModuleContext,
  WorkbenchModuleContribution,
  WorkbenchPanelMenuDefinition,
  WorkbenchRegion,
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
  | "floating-panel-free"
  | "cross-panel-history";

export const resources = [
  {
    kind: LOCATION_KIND,
    uri: `${LOCATION_KIND}:alpha`,
    id: "alpha",
    label: "Alpha location",
    icon: "Folder",
  },
  {
    kind: LOCATION_KIND,
    uri: `${LOCATION_KIND}:beta`,
    id: "beta",
    label: "Beta location",
    icon: "Folder",
  },
];

const RESOURCE_SCOPE_PREFIX = "project/demo/mode/locations/resource/";
const projectOwnedRegions: WorkbenchRegion[] = [
  "nav",
  "sidenav-header",
  "sidenav",
  "side-header",
  "side-left-menu",
  "side",
  "side-right-menu",
  "status",
];

const openCompositionResource = (workbench: WorkbenchCore, resource: (typeof resources)[number]) => {
  if (workbench.layout.getPersistenceScope()?.startsWith(RESOURCE_SCOPE_PREFIX)) {
    const scope = `${RESOURCE_SCOPE_PREFIX}${resource.uri}`;
    workbench.panels.setPersistenceScope(scope);
    workbench.layout.setPersistenceScope(scope, {
      carryRegionState: projectOwnedRegions,
    });
  }
  void workbench.resources.openResource(resource, { replaceActive: true });
};

const CompositionContent = (props: { workbench: WorkbenchCore; title: string }) => {
  const { title, workbench } = props;
  return (
    <ScrollArea
      h="full"
      bg="bg"
      contentProps={{
        p: "lg",
        display: "flex",
        flexDirection: "column",
        gap: "md",
      }}
    >
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
            onClick={() => openCompositionResource(workbench, resource)}
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

const locationMenuId = "onboarding.panel-composition.location.tools";

const locationPanelMenus = (kind: CompositionKind): WorkbenchPanelMenuDefinition[] => {
  if (!compositionFlags(kind).hasMenus) return [];
  return [
    {
      id: locationMenuId,
      title: kind === "location-switch" ? "Location tools" : "Location inspector",
      icon: kind === "location-switch" ? "ListTree" : "SlidersHorizontal",
      side: "left",
      rendererId: RENDERER_ID,
    },
  ];
};

interface SubPanelFixtureDefinition {
  id: string;
  title: string;
  icon: string;
  panelMenus: readonly (Omit<WorkbenchPanelMenuDefinition, "id"> & {
    key: string;
  })[];
}

const subPanelDefinitions = (kind: CompositionKind): SubPanelFixtureDefinition[] => [
  {
    id: "notes",
    title: "Notes",
    icon: "FileText",
    panelMenus: compositionFlags(kind).hasMenus
      ? [
          {
            key: "tools",
            title: "Notes tools",
            icon: kind === "location-switch" ? "FileText" : "SlidersHorizontal",
            side: "right",
            rendererId: RENDERER_ID,
          },
        ]
      : [],
  },
  {
    id: "reports",
    title: "Reports",
    icon: "ChartNoAxesColumn",
    panelMenus: [],
  },
];

const compositionFlags = (kind: CompositionKind) => ({
  hasEligible: kind !== "location-only" && kind !== "menu-only" && kind !== "collapsed-menu",
  hasMenus: ["menu-only", "collapsed-menu", "sub-panels-menu", "all-panels", "location-switch"].includes(kind),
  openRegions:
    kind === "all-panels" || kind === "cross-panel-history"
      ? panelRegions
      : kind === "floating-panel-free"
        ? (["side"] as const)
        : kind === "open" || kind === "sub-panels-menu" || kind === "location-switch"
          ? (["main"] as const)
          : [],
});

const collapseMenu = (
  workbench: Pick<WorkbenchCore, "layout" | "panels">,
  menuRegion: "main" | "secondary",
  panelId: string,
) => {
  const menu = workbench.layout.listPanelInstances(`${menuRegion}-left-menu`).find((p) => p.panelId === panelId);
  if (menu) workbench.panels.setOpen(`panel-menu:${menu.instanceId}`, false);
};

const applyLocationSwitch = async (
  workbench: Pick<WorkbenchCore, "layout" | "panels" | "resources">,
  alphaLocation: { instanceId: string },
) => {
  collapseMenu(workbench, "main", locationMenuId);
  const notesMenu = workbench.layout
    .listPanelInstances("main-right-menu")
    .find((panel) => panel.panelId === "onboarding.panel-composition.main.notes.tools");
  if (notesMenu) workbench.panels.setOpen(`panel-menu:${notesMenu.instanceId}`, false);
  await workbench.resources.openResource(resources[1]);
  workbench.layout.openPanel("onboarding.panel-composition.main.reports");
  workbench.layout.activatePanel(alphaLocation.instanceId);
  const alphaNotes = workbench.layout
    .listPanelInstances("main")
    .find(
      (panel) =>
        panel.panelId === "onboarding.panel-composition.main.notes" && panel.ownerResourceUri === resources[0].uri,
    );
  if (alphaNotes) workbench.layout.activatePanel(alphaNotes.instanceId);
};

const openPanelCompositionScenario = (
  workbench: Pick<WorkbenchCore, "layout" | "panels" | "resources">,
  kind: CompositionKind,
) => {
  const flags = compositionFlags(kind);
  void workbench.resources.openResource(resources[0]).then(async (alphaLocation) => {
    for (const region of flags.openRegions) {
      workbench.layout.openPanel(`onboarding.panel-composition.${region}.notes`);
    }
    if (kind === "cross-panel-history") {
      for (const region of panelRegions) workbench.layout.openPanel(`onboarding.panel-composition.${region}.reports`);
    }
    if (kind === "collapsed-menu") {
      collapseMenu(workbench, "main", locationMenuId);
    }
    if (kind === "location-switch") {
      await applyLocationSwitch(workbench, alphaLocation);
    }
  });
};

const registerPanelFixture = (ctx: WorkbenchModuleContext, kind: CompositionKind) => {
  ctx.resources.registerKind({
    kind: LOCATION_KIND,
    label: "Location",
    icon: "Folder",
    surface: "primary",
  });
  ctx.resources.registerPresenter({
    id: `onboarding.panel-composition.${kind}.presenter`,
    canOpen: (resource) => resource.kind === LOCATION_KIND,
    open: (resource, input) => {
      ctx.breadcrumbs.setItems([{ title: resource.label ?? "Location", icon: resource.icon, resource }]);
      return ctx.layout.openPanel(LOCATION_ID, {
        strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "activate-or-open" },
        resource,
        title: resource.label,
      });
    },
  });
  ctx.renderers.registerRenderer({
    id: RENDERER_ID,
    render: ({ instance, panel, workbench }) => {
      const title = instance.title ?? "Panel composition";
      if ("panelMenus" in panel && panel.panelMenus) return <PanelMenuContent title={title} />;
      if ("eligibleLocations" in panel && panel.eligibleLocations) return <SubPanelContent title={title} />;
      return <CompositionContent workbench={workbench} title={title} />;
    },
  });
  ctx.layout.registerPanel({
    closable: false,
    id: LOCATION_ID,
    title: "Location",
    region: "main",
    singleton: false,
    resourceKinds: [LOCATION_KIND],
    rendererId: RENDERER_ID,
    ...(kind === "floating-panel-free" ? { floatingPanels: "hidden" as const } : {}),
    panelMenus: locationPanelMenus(kind),
  });
};

const registerEligiblePanelFixtures = (ctx: WorkbenchModuleContext, kind: CompositionKind) => {
  for (const region of panelRegions) {
    for (const definition of subPanelDefinitions(kind)) {
      ctx.layout.registerPanel({
        closable: true,
        id: `onboarding.panel-composition.${region}.${definition.id}`,
        title: definition.title,
        icon: definition.icon,
        region,
        singleton: true,
        rendererId: RENDERER_ID,
        eligibleLocations: { resourceKinds: [LOCATION_KIND] },
        panelMenus: definition.panelMenus.map(({ key, ...menu }) => ({
          ...menu,
          id: `onboarding.panel-composition.${region}.${definition.id}.${key}`,
        })),
      });
    }
  }
};

export const createPanelCompositionModule = (
  kind: CompositionKind,
  openInitial = true,
): WorkbenchModuleContribution => ({
  id: `onboarding.panel-composition.${kind}`,
  activate(ctx) {
    const flags = compositionFlags(kind);
    registerPanelFixture(ctx, kind);
    if (flags.hasEligible) registerEligiblePanelFixtures(ctx, kind);

    if (openInitial) openPanelCompositionScenario(ctx, kind);
  },
});

export const createPanelCompositionWorkbench = (kind: CompositionKind) => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(createPanelCompositionModule(kind));
  if (kind === "all-panels" || kind === "cross-panel-history") workbench.sidePanel.setMode("attached");
  if (kind === "floating-panel-free") workbench.sidePanel.setMode("floating");
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
  const first = createWorkbenchCore({
    historyPersistence: persistence.history,
    layoutPersistence: persistence.layout,
  });
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
  restored.sidePanel.setMode("attached");
  return restored;
};
