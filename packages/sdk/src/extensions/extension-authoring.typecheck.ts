import type {
  ControlsQueryParams,
  DataTableRendererQueryParams,
  FileRendererLoadParams,
  KanbanRendererQueryParams,
  ResourceRef,
  TreeRendererQueryParams,
} from "./index";
import { defineExtension, packageAsset, params, projectSlots, workspaceSlots } from "./index";

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
      layout: {
        panels: ["main"],
        open: [
          { region: "sidenav", panel: "labSidenav", pinned: true },
          { region: "main", panel: "labOverview" },
        ],
      },
    },
    focus: {
      label: "Lab focus",
      layout: {
        panels: ["main"],
        open: [{ region: "main", panel: "labOverview" }],
      },
    },
    unsafe: {
      label: "Unsafe",
      layout: {
        panels: [
          // @ts-expect-error mode panels are logical Main, Secondary, or Side roles
          "overlay",
        ],
        open: [
          {
            // @ts-expect-error mode layout regions use the declared Workbench regions
            region: "workbench.overlay",
            panel: "labOverview",
          },
        ],
      },
    },
  },
  panels: {
    labSidenav: {
      title: "Lab sidenav",
      region: "sidenav",
      closable: false,
      webview: { entry: packageAsset("./lab-sidenav.tsx", import.meta.url) },
    },
    labOverview: {
      title: "Lab overview",
      region: "main",
      closable: false,
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
