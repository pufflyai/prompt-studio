import type {
  ControlsQueryParams,
  DataTableRendererQueryParams,
  FileRendererLoadParams,
  KanbanRendererQueryParams,
  NavigationTarget,
  RendererEventReference,
  ResourceRef,
  TreeRendererQueryParams,
} from "./index";
import {
  defineCommand,
  defineExtension,
  defineMode,
  defineNavigationItem,
  definePage,
  definePlacement,
  defineResourceHierarchyProvider,
  defineResourceKind,
  defineResourceView,
  defineView,
  eventRef,
  packageAsset,
  params,
  projectSlots,
  resourceSlotRef,
  workbenchSlots,
  workspaceSlots,
} from "./index";

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
  commands: [
    defineCommand({
      id: "run-attempt",
      title: "Run attempt",
      params: {
        ticket: params.text({ required: true }),
        harness: params.harness({ required: false }),
      },
      async run(ctx, commandParams) {
        const ticket: string = commandParams.ticket;
        const harness: { harnessId: string; model?: string } | undefined = commandParams.harness;
        const enabled: unknown = await ctx.settings.get("counter.enabled");
        const tone: unknown = await ctx.settings.get("greeting.tone");
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
        const requiredHarness: { harnessId: string } = commandParams.harness;
        void requiredHarness;

        // @ts-expect-error command params are not stored on the context
        void ctx.params;

        // @ts-expect-error command params are passed only as the second handler argument
        void ctx.invocation.params;
      },
    }),
    defineCommand({
      id: "inspect-workspace",
      title: "Inspect workspace",
      params: {
        workspaceId: params.text({ required: true }),
      },
      async run(ctx, commandParams) {
        const workspace = await ctx.workspaces.get(commandParams.workspaceId);
        const workspaceByShorthand = await ctx.workspaces.getByShorthand("PS-1_A1");
        const worktreePath: string | null | undefined = workspace?.worktree_path;
        const shorthandWorktreePath: string | null | undefined = workspaceByShorthand?.worktree_path;
        const removed: boolean = (await ctx.workspaces.removeWorktree(commandParams.workspaceId)).removed;
        const packagedGuide: string = await ctx.packageFiles.readText("guide.md");
        void worktreePath;
        void shorthandWorktreePath;
        void removed;
        void packagedGuide;

        if (ctx.extensionFiles) await ctx.extensionFiles.writeText("cache/index.json", "{}");
        // @ts-expect-error packaged extension files are read-only
        await ctx.packageFiles.writeText("guide.md", "changed");
      },
    }),
  ],
});

void extension;

// @ts-expect-error alpha.4 contributions use arrays with explicit local ids
defineExtension({ commands: { legacy: { title: "Legacy", run: async () => undefined } } });

// @ts-expect-error alpha.4 middleware has no commandId alias
defineExtension({ middlewares: [{ id: "legacy", commandId: "legacy.command", handler: async () => undefined }] });

const invalidBooleanEnum = [true, "false"];

const invalidSettingDeclarations = defineExtension({
  settings: {
    properties: {
      // @ts-expect-error setting defaults must match their declared type
      "counter.invalidDefault": {
        type: "number",
        scope: "project",
        default: "1",
      },
      "counter.invalidEnum": {
        type: "boolean",
        scope: "project",
        // @ts-expect-error setting enum values must match their declared type
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

const ticketKind = defineResourceKind({
  id: "ticket",
  surface: "primary",
  slots: [
    { id: "primary", cardinality: "one", access: "owner" },
    { id: "inspector", cardinality: "many", access: "public" },
  ],
});
const ticketPrimary = resourceSlotRef(ticketKind.ref, "primary");
const ticketEditor = defineView({
  id: "editor",
  title: "Ticket editor",
  body: { kind: "webview", entry: packageAsset("./editor.tsx", import.meta.url) },
});
const ticketInsights = defineView({
  id: "insights",
  title: "Insights",
  body: {
    kind: "controls",
    refreshEvents: [eventRef({ extensionId: "planner", id: "ticketChanged" }), "planner.ticket-saved"],
    query: async () => ({ values: {} }),
  },
});
const reviewMode = defineMode({ id: "review", label: "Review", regions: ["main", "side"] });
// @ts-expect-error modes must declare the regions available to their pages
defineMode({ id: "missing-regions", label: "Missing regions" });
const ticketsPage = definePage({
  id: "tickets",
  title: "Tickets",
  path: "tickets",
  mode: reviewMode.ref,
  slots: [
    { id: "ticket", role: "primary", region: "main", binding: { kind: ticketKind.ref, view: ticketEditor.ref } },
    { id: "insights", role: "auxiliary", region: "side", view: ticketInsights.ref },
  ],
});

const insightsPanelTarget: NavigationTarget = { kind: "panel", panel: ticketsPage.panels.insights };
void insightsPanelTarget;

// @ts-expect-error primary page slots are not addressable panel targets
void ticketsPage.panels.ticket;

const compositionExtension = defineExtension({
  resourceKinds: [ticketKind],
  views: [ticketEditor, ticketInsights],
  resourceViews: [
    defineResourceView({
      id: "editor",
      resourceKind: ticketKind.ref,
      slot: ticketPrimary,
      view: ticketEditor.ref,
    }),
  ],
  modes: [reviewMode],
  pages: [ticketsPage],
  placements: [
    definePlacement({
      id: "editor",
      mode: reviewMode.ref,
      item: { kind: "resource-slot", slot: ticketPrimary },
      region: "main",
      required: true,
    }),
  ],
  navigationItems: [
    defineNavigationItem({
      id: "tickets-root",
      slot: workbenchSlots.projectNavigation,
      label: "Tickets",
      action: { kind: "resource", resource: { type: "ticket", id: "root" } },
    }),
  ],
  resourceHierarchyProviders: [
    defineResourceHierarchyProvider({
      id: "ticket",
      resourceKind: ticketKind.ref,
      parent: (_ctx, resource) => (resource.id === "root" ? null : null),
    }),
  ],
});

void compositionExtension;

const navigationTarget: NavigationTarget = {
  kind: "page",
  page: ticketsPage.ref,
  resource: { type: "ticket", id: "PS-1" },
};
void navigationTarget;

definePlacement({
  id: "invalid",
  mode: reviewMode.ref,
  item: { kind: "view", view: ticketEditor.ref },
  // @ts-expect-error mode recipes accept only declared docked regions
  region: "overlay",
});

// @ts-expect-error local events use typed refs; raw strings must be namespaced
const invalidLocalEventReference: RendererEventReference = "changed";
void invalidLocalEventReference;
