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
        void ticket;
        void harness;
        void enabled;
        void tone;

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
        reset: true,
        open: [
          { target: "workbench.left", view: "labSidebar", pinned: true },
          { target: "workbench.main", view: "labOverview" },
        ],
      },
    },
    focus: {
      label: "Lab focus",
      layout: {
        reset: ["workbench.main"],
        open: [{ target: "workbench.main", view: "labOverview" }],
      },
    },
    unsafe: {
      label: "Unsafe",
      layout: {
        reset: [
          // @ts-expect-error mode layout reset targets are limited to safe content areas
          "workbench.nav",
        ],
        open: [
          {
            // @ts-expect-error mode layout open targets are limited to safe content areas
            target: "workbench.overlay",
            view: "labOverview",
          },
        ],
      },
    },
  },
  views: {
    labSidebar: {
      title: "Lab sidebar",
      webview: { entry: packageAsset("./lab-sidebar.tsx", import.meta.url) },
    },
    labOverview: {
      title: "Lab overview",
      webview: { entry: packageAsset("./lab-overview.tsx", import.meta.url) },
    },
  },
});

void extension;

const unsupportedNavigation = defineExtension({
  // @ts-expect-error legacy navigation contributions are no longer supported
  navigation: {
    lab: {
      slot: "project.sidebarNav",
      label: "Lab",
      route: "lab",
    },
  },
});

void unsupportedNavigation;

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
void projectSlots.sidebarNav;

// @ts-expect-error command palette contributions use command.palette
void projectSlots.commandPanel;

// @ts-expect-error legacy navigation slots are no longer exposed
void workspaceSlots.tabs;
