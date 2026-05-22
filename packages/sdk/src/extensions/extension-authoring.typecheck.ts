import { attemptStatusEvents, defineExtension, params, workspaceCommands } from "./index";

const extension = defineExtension({
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
        void ticket;
        void harness;

        // @ts-expect-error optional params must be checked before use
        const requiredHarness: { harnessId: string } = ctx.params.harness;
        void requiredHarness;
      },
    },
    inspectWorkspace: {
      title: "Inspect workspace",
      params: {
        workspaceId: params.text({ required: true }),
      },
      async run(ctx) {
        const workspace = await ctx.workspaces.get(ctx.params.workspaceId);
        const worktreePath: string | null | undefined = workspace?.worktree_path;
        void worktreePath;
      },
    },
  },
  middlewares: {
    reviewReadyValidation: {
      command: workspaceCommands.setAttemptStatus,
      async handler(ctx) {
        const workspaceId: string = ctx.params.workspaceId;
        const status: string = ctx.params.status;
        void workspaceId;
        void status;
        return ctx.commands.continue();
      },
    },
  },
  hooks: {
    attemptStatusChanged: {
      event: attemptStatusEvents.changed,
      async handler(_ctx, payload) {
        const workspaceId: string = payload.workspace.id;
        const worktreePath: string | null | undefined = payload.workspace.worktree_path;
        const ticketRef: string | undefined = payload.ticket?.shorthand ?? payload.ticket?.id;
        const ticketStatus: string | null | undefined = payload.ticket?.status_name;
        void workspaceId;
        void worktreePath;
        void ticketRef;
        void ticketStatus;
      },
    },
  },
});

void extension;
