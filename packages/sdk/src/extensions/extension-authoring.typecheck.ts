import type {
  ControlsQueryParams,
  DataTableRendererQueryParams,
  FileRendererLoadParams,
  KanbanRendererQueryParams,
  ModePlacementContribution,
  PanelContribution,
  RendererEventReference,
  ResourceRef,
  TreeRendererQueryParams,
  WorkbenchNavigationTarget,
} from "./index";
import { defineExtension, eventRef, packageAsset, params, projectSlots, workspaceSlots } from "./index";

const extension = defineExtension({
  settings: {
    properties: {
      "counter.enabled": {
        type: "boolean",
        scope: "project",
        default: true,
      },
      "counter.step": {
        type: "number",
        scope: "project",
        default: 1,
      },
      "greeting.tone": {
        type: "string",
        scope: "global",
        enum: ["friendly", "formal"],
        default: "friendly",
      },
    },
  },
  commands: {
    runAttempt: {
      title: "Run attempt",
      params: {
        ticket: params.text({ required: true }),
        harness: params.harness({ required: false }),
      },
      async run(ctx) {
        const ticket: string = ctx.params.ticket;
        const harness: { harnessId: string; model?: string } | undefined = ctx.params.harness;
        const enabled: boolean | undefined = await ctx.settings.get("counter.enabled");
        const tone: string | undefined = await ctx.settings.get("greeting.tone");
        const session = await ctx.sessions.create({ title: "Inspect ticket", prompt: ticket });
        const sessionType: "session" = session.type;
        const sessionTitle: string = session.title;
        const sessionStatus: string = session.status;
        void ticket;
        void harness;
        void enabled;
        void tone;
        void sessionType;
        void sessionTitle;
        void sessionStatus;

        // @ts-expect-error optional params must be checked before use
        const requiredHarness: { harnessId: string } = ctx.params.harness;
        void requiredHarness;

        // @ts-expect-error unknown declared setting keys are rejected
        await ctx.settings.get("counter.missing");

        // @ts-expect-error values must match the declared setting type
        await ctx.settings.set("counter.step", "large");
      },
    },
    inspectWorkspace: {
      title: "Inspect workspace",
      params: {
        workspaceId: params.text({ required: true }),
      },
      async run(ctx) {
        const workspace = await ctx.workspaces.get(ctx.params.workspaceId);
        const workspaceByShorthand = await ctx.workspaces.getByShorthand("PS-1_A1");
        const worktreePath: string | null | undefined = workspace?.worktree_path;
        const shorthandWorktreePath: string | null | undefined = workspaceByShorthand?.worktree_path;
        void worktreePath;
        void shorthandWorktreePath;
      },
    },
  },
  modes: {
    lab: {
      id: "pstdio.typecheck.lab",
      label: "Lab",
      panelRegions: ["main"],
      modePanels: {
        labSidenav: { region: "sidenav", required: true },
        labOverview: { region: "main", required: true },
      },
    },
    focus: {
      label: "Lab focus",
      panelRegions: ["main"],
      modePanels: { labOverview: { region: "main" } },
    },
    unsafe: {
      label: "Unsafe",
      panelRegions: [
        // @ts-expect-error mode panel regions are logical Main, Secondary, or Side roles
        "overlay",
      ],
      modePanels: {
        labOverview: {
          // @ts-expect-error mode placements use the four docked regions
          region: "workbench.overlay",
        },
      },
    },
  },
  panels: {
    labSidenav: {
      title: "Lab sidenav",
      supportedRegions: ["sidenav"],
      webview: { entry: packageAsset("./lab-sidenav.tsx", import.meta.url) },
    },
    labOverview: {
      title: "Lab overview",
      supportedRegions: ["main"],
      webview: { entry: packageAsset("./lab-overview.tsx", import.meta.url) },
    },
  },
});

void extension;

const invalidBooleanEnum = [true, "false"];

const invalidSettingDeclarations = defineExtension({
  settings: {
    properties: {
      // @ts-expect-error setting defaults must match the declared setting type
      "counter.invalidDefault": {
        type: "number",
        scope: "project",
        default: "1",
      },
      "counter.invalidEnum": {
        type: "boolean",
        scope: "project",
        // @ts-expect-error setting enum values must match the declared setting type
        enum: invalidBooleanEnum,
      },
    },
  },
});

void invalidSettingDeclarations;

// @ts-expect-error legacy navigation slots are no longer exposed
void projectSlots.sidenavNav;

// @ts-expect-error command palette contributions use command.palette
void projectSlots.commandPanel;

// @ts-expect-error legacy navigation slots are no longer exposed
void workspaceSlots.tabs;

const sharedRendererResource: ResourceRef = { type: "ticket", id: "PS-1", projectId: "project-1" };

const dataTableQueryParams: DataTableRendererQueryParams = {
  renderer: {
    rendererId: "lab.table",
    projectId: "project-1",
    modeId: "pstdio.lab.review",
    resource: sharedRendererResource,
    invocation: { placement: "visible" },
  },
};
const kanbanQueryParams: KanbanRendererQueryParams = {
  renderer: dataTableQueryParams.renderer,
  settings: {
    viewMode: "board",
    columnGrouping: "status",
    rowGrouping: "none",
    ordering: { attributeId: "status", direction: "asc" },
    displayProperties: [],
  },
  filters: {},
};
const treeQueryParams: TreeRendererQueryParams = { renderer: dataTableQueryParams.renderer };
const fileLoadParams: FileRendererLoadParams = { renderer: dataTableQueryParams.renderer };
const controlsQueryParams: ControlsQueryParams = { renderer: dataTableQueryParams.renderer };

void dataTableQueryParams;
void kanbanQueryParams;
void treeQueryParams;
void fileLoadParams;
void controlsQueryParams;

const compositionExtension = defineExtension({
  resourceKinds: {
    ticket: {
      surface: "primary",
      slots: {
        primary: { cardinality: "one", external: false },
        navigation: { cardinality: "many", external: true },
        inspector: { cardinality: "many", external: true },
      },
    },
  },
  panels: {
    editor: {
      title: "Ticket editor",
      supportedRegions: ["main"],
      webview: { entry: packageAsset("./editor.tsx", import.meta.url) },
    },
    // A cross-extension contribution uses namespaced refresh events; local ones use typed refs.
    insights: {
      title: "Insights",
      supportedRegions: ["side", "secondary"],
      renderer: { kind: "controls", id: "insightControls" },
    },
  },
  controlsRenderers: {
    insightControls: {
      title: "Insight controls",
      refreshEvents: [eventRef("ticketChanged"), "planner.ticket-saved"],
      query: async () => ({ values: {} }),
    },
  },
  resourcePanels: {
    // Bare ids resolve inside the declaring extension.
    editor: { resourceKind: "ticket", panel: "editor", slot: "primary" },
    // Cross-extension references use the namespaced form.
    plannerInsights: { resourceKind: "planner.ticket", panel: "insights", slot: "inspector" },
  },
  modes: {
    review: {
      label: "Review",
      defaultResource: { type: "ticket", id: "root" },
      resources: {
        ticket: {
          slots: {
            primary: { region: "main", required: true },
            inspector: { region: "side", allowedRegions: ["side", "secondary"] },
          },
          panels: {
            "acme.insights": { region: "secondary" },
          },
        },
      },
      modePanels: {
        editor: { region: "main" },
      },
    },
    resolved: {
      label: "Resolved",
      defaultResource: { commandId: "review.default-resource" },
    },
  },
  treeItems: {
    ticketsRoot: {
      target: "workbench.left.tree",
      label: "Tickets",
      // `null` means root placement without a heading; `undefined` keeps default grouping.
      group: null,
      action: { kind: "resource", resource: { type: "ticket", id: "root" } },
    },
    grouped: {
      target: "workbench.left.tree",
      label: "Grouped",
      action: { kind: "route", route: "/lab" },
    },
  },
  resourceHierarchyProviders: {
    ticket: {
      resourceKind: "ticket",
      parent: (_ctx, resource) => (resource.id === "root" ? null : null),
    },
  },
});

void compositionExtension;

const navigationTarget: WorkbenchNavigationTarget = {
  modeId: "review",
  resource: { type: "ticket", id: "PS-1" },
  replaceActive: true,
};
void navigationTarget;

const invalidCompositionPanel: PanelContribution = {
  title: "Chrome",
  supportedRegions: [
    // @ts-expect-error composition panels accept only the four docked regions
    "activity",
  ],
  webview: { entry: packageAsset("./chrome.tsx", import.meta.url) },
};
void invalidCompositionPanel;

const invalidRecipePlacement: ModePlacementContribution = {
  // @ts-expect-error mode recipes accept only the four docked regions
  region: "overlay",
};
void invalidRecipePlacement;

// @ts-expect-error local events use typed refs; raw strings must be namespaced
const invalidLocalEventReference: RendererEventReference = "changed";
void invalidLocalEventReference;
