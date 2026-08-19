import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { runAttemptCommand } from "./run-attempt";
import {
  approveProposalCommand,
  breakIntoSubTicketsCommand,
  createWorkspaceCommand,
  proposalRefinedCommand,
  refineTicketCommand,
} from "./ticket-actions";

const createSessionResource = () => ({
  type: "session" as const,
  id: "session-1",
  title: "Session",
  status: "in_progress" as const,
});

describe("runAttemptCommand", () => {
  test("exposes mode as a workspace mode selector defaulting to worktree", () => {
    expect(runAttemptCommand.params?.mode).toEqual({
      type: "select",
      label: "Mode",
      required: false,
      defaultValue: "worktree",
      options: [
        { label: "Worktree", value: "worktree", icon: "GitFork" },
        { label: "Current branch", value: "current_branch", icon: "GitBranch" },
      ],
    });
  });

  test("creates an anchored workspace and session with the ticket shorthand in the prompt", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    const workspaces: unknown[] = [];
    const sessions: unknown[] = [];

    const result = await runAttemptCommand.run(
      makeCommandContext({
        storage,
        params: { rowId: ticket.id },
        overrides: {
          workspaces: {
            create: async (input: unknown) => {
              workspaces.push(input);
              return { id: "workspace-1", workspace_shorthand: "T-1_A1" };
            },
          } as never,
          sessions: {
            create: async (input: unknown) => {
              sessions.push(input);
              return createSessionResource();
            },
          } as never,
        },
      }),
    );

    expect(result).toMatchObject({
      decision: "started",
      mode: "worktree",
      ticket,
      workspace: { id: "workspace-1", workspace_shorthand: "T-1_A1" },
      session: { ...createSessionResource(), workspace_id: "workspace-1" },
      attempt: {
        workspaceId: "workspace-1",
        ticketId: ticket.id,
        implementationSessionId: "session-1",
        state: "implementing",
        base: { workspaceId: null, headSha: "main-sha" },
      },
    });
    expect((await ticketsCollection(storage).get(ticket.id))?.statusId).toBe("in-progress");
    expect(workspaces).toEqual([
      {
        anchors: [
          {
            type: "ticket",
            id: ticket.id,
            projectId: "proj-1",
            extensionId: "pstdio-planner",
            label: "T-1",
            role: "primary",
            metadata: {
              shorthand: "T-1",
              resourceParent: {
                type: "extension-view",
                id: "pstdio-planner.tickets",
                label: "Tickets",
                icon: "square-kanban",
              },
            },
          },
        ],
        base: "main-sha",
        mode: "worktree",
        project_id: "proj-1",
        shorthand_base: "T-1",
      },
    ]);
    expect(sessions).toEqual([
      expect.objectContaining({
        anchors: expect.arrayContaining([
          {
            type: "ticket",
            id: ticket.id,
            projectId: "proj-1",
            extensionId: "pstdio-planner",
            label: "T-1",
            role: "primary",
            metadata: {
              shorthand: "T-1",
              resourceParent: {
                type: "extension-view",
                id: "pstdio-planner.tickets",
                label: "Tickets",
                icon: "square-kanban",
              },
            },
          },
          expect.objectContaining({ type: "planner-attempt", id: "workspace-1" }),
        ]),
        template: "implement-ticket",
        title: "Implement ticket: T-1",
        vars: { ticket: "T-1", workspaceId: "workspace-1" },
        workspaceId: "workspace-1",
      }),
    ]);
  });

  test("preserves explicit agent, repo, and current-branch params", async () => {
    const workspaces: unknown[] = [];
    const sessions: unknown[] = [];

    await runAttemptCommand.run(
      makeCommandContext({
        storage: createMemoryStorage(),
        params: {
          ticket: "PS-304",
          agent: { harnessId: "codex", model: "gpt-5" },
          repo: { repoId: "repo-1", branch: "main" },
          mode: "current_branch",
        },
        overrides: {
          workspaces: {
            create: async (input: unknown) => {
              workspaces.push(input);
              return { id: "workspace-1", workspace_shorthand: "PS-304_A1" };
            },
          } as never,
          sessions: {
            create: async (input: unknown) => {
              sessions.push(input);
              return createSessionResource();
            },
          } as never,
        },
      }),
    );

    expect(workspaces).toEqual([
      {
        anchors: [
          {
            type: "ticket",
            id: "PS-304",
            projectId: "proj-1",
            extensionId: "pstdio-planner",
            label: "PS-304",
            role: "primary",
            metadata: { shorthand: "PS-304" },
          },
        ],
        base: "main-sha",
        mode: "current_branch",
        project_id: "proj-1",
        repo_id: "repo-1",
        shorthand_base: "PS-304",
      },
    ]);
    expect(sessions).toEqual([
      expect.objectContaining({
        anchors: expect.arrayContaining([
          {
            type: "ticket",
            id: "PS-304",
            projectId: "proj-1",
            extensionId: "pstdio-planner",
            label: "PS-304",
            role: "primary",
            metadata: { shorthand: "PS-304" },
          },
          expect.objectContaining({ type: "planner-attempt", id: "workspace-1" }),
        ]),
        harness: { harnessId: "codex", model: "gpt-5" },
        template: "implement-ticket",
        title: "Implement ticket: PS-304",
        vars: { ticket: "PS-304", workspaceId: "workspace-1" },
        workspaceId: "workspace-1",
      }),
    ]);
  });
});

describe("runAttemptCommand guarded launches", () => {
  test("falls back to the row id when the ticket param is empty", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    const workspaces: unknown[] = [];

    await runAttemptCommand.run(
      makeCommandContext({
        storage,
        params: { ticket: "", rowId: ticket.id },
        overrides: {
          workspaces: {
            create: async (input: unknown) => {
              workspaces.push(input);
              return { id: "workspace-1", workspace_shorthand: "T-1_A1" };
            },
          } as never,
          sessions: {
            create: async () => createSessionResource(),
          } as never,
        },
      }),
    );

    expect(workspaces).toEqual([
      {
        anchors: [
          {
            type: "ticket",
            id: ticket.id,
            projectId: "proj-1",
            extensionId: "pstdio-planner",
            label: "T-1",
            role: "primary",
            metadata: {
              shorthand: "T-1",
              resourceParent: {
                type: "extension-view",
                id: "pstdio-planner.tickets",
                label: "Tickets",
                icon: "square-kanban",
              },
            },
          },
        ],
        base: "main-sha",
        mode: "worktree",
        project_id: "proj-1",
        shorthand_base: "T-1",
      },
    ]);
  });

  test("creates at most one attempt for concurrent launch decisions", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    let releaseWorkspace!: () => void;
    const workspaceGate = new Promise<void>((resolve) => {
      releaseWorkspace = resolve;
    });
    let creates = 0;
    const context = () =>
      makeCommandContext({
        storage,
        params: { ticket: ticket.shorthand },
        overrides: {
          workspaces: {
            create: async () => {
              creates += 1;
              await workspaceGate;
              return { id: "workspace-1", workspace_shorthand: "T-1_A1" };
            },
          } as never,
          sessions: { create: async () => createSessionResource() } as never,
        },
      });

    const pending = Promise.all([runAttemptCommand.run(context()), runAttemptCommand.run(context())]);
    await Promise.resolve();
    releaseWorkspace();
    const results = await pending;

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ decision: "wait", reason: "launch-claimed" }),
        expect.objectContaining({ decision: "started" }),
      ]),
    );
    expect(creates).toBe(1);
  });
});

describe("createWorkspaceCommand", () => {
  test("exposes mode as a workspace mode selector defaulting to worktree", () => {
    expect(createWorkspaceCommand.params?.mode).toEqual(runAttemptCommand.params?.mode);
  });

  test("creates an anchored workspace for the ticket without starting a session", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    const workspaces: unknown[] = [];
    const sessions: unknown[] = [];

    const result = await createWorkspaceCommand.run(
      makeCommandContext({
        storage,
        params: { rowId: ticket.id },
        overrides: {
          workspaces: {
            create: async (input: unknown) => {
              workspaces.push(input);
              return { id: "workspace-1", workspace_shorthand: "T-1_A1" };
            },
          } as never,
          sessions: {
            create: async (input: unknown) => {
              sessions.push(input);
              return createSessionResource();
            },
          } as never,
        },
      }),
    );

    expect(result).toEqual({
      mode: "worktree",
      ticket,
      workspace: { id: "workspace-1", workspace_shorthand: "T-1_A1" },
      session: null,
    });
    expect(workspaces).toEqual([
      {
        anchors: [
          {
            type: "ticket",
            id: ticket.id,
            projectId: "proj-1",
            extensionId: "pstdio-planner",
            label: "T-1",
            role: "primary",
            metadata: {
              shorthand: "T-1",
              resourceParent: {
                type: "extension-view",
                id: "pstdio-planner.tickets",
                label: "Tickets",
                icon: "square-kanban",
              },
            },
          },
        ],
        mode: "worktree",
        project_id: "proj-1",
        shorthand_base: "T-1",
      },
    ]);
    expect(sessions).toEqual([]);
  });

  test("stores ticket ancestry on created workspace anchors", async () => {
    const storage = createMemoryStorage();
    const parent = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Parent" } }));
    const child = await createTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Child", parentId: parent.id } }),
    );
    const workspaces: unknown[] = [];

    await createWorkspaceCommand.run(
      makeCommandContext({
        storage,
        params: { rowId: child.id },
        overrides: {
          workspaces: {
            create: async (input: unknown) => {
              workspaces.push(input);
              return { id: "workspace-1", workspace_shorthand: "T-2_A1" };
            },
          } as never,
        },
      }),
    );

    expect(workspaces).toEqual([
      expect.objectContaining({
        anchors: [
          expect.objectContaining({
            id: child.id,
            metadata: {
              shorthand: child.shorthand,
              resourceParent: {
                type: "ticket",
                id: parent.id,
                label: `${parent.shorthand} Parent`,
                metadata: {
                  shorthand: parent.shorthand,
                  resourceParent: {
                    type: "extension-view",
                    id: "pstdio-planner.tickets",
                    label: "Tickets",
                    icon: "square-kanban",
                  },
                },
              },
            },
          }),
        ],
      }),
    ]);
  });
});

describe("proposal notifications", () => {
  test("refine ticket starts refinement without emitting a proposal review notification", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Proposal" } }));
    const notifications: unknown[] = [];

    await refineTicketCommand.run(
      makeCommandContext({
        storage,
        params: { ticket: ticket.shorthand },
        overrides: {
          notify: {
            action: async (input: unknown) => {
              notifications.push(input);
              return {};
            },
          } as never,
          sessions: { create: async () => createSessionResource() } as never,
        },
      }),
    );

    expect(notifications).toEqual([]);
  });

  test("proposal refined emits a proposal review notification", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Proposal" } }));
    const notifications: unknown[] = [];

    await proposalRefinedCommand.run(
      makeCommandContext({
        storage,
        params: { id: ticket.shorthand },
        overrides: {
          notify: {
            action: async (input: unknown) => {
              notifications.push(input);
              return {};
            },
          } as never,
        },
      }),
    );

    expect(notifications).toEqual([
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({ command: "pstdio-planner.approve-proposal", label: "Approve" }),
        ]),
        dedupeKey: "pstdio-planner:ticket:T-1:proposal-refined",
        kind: "needs_review",
        target: expect.objectContaining({ id: ticket.id, type: "ticket" }),
      }),
    ]);
  });

  test("approve proposal resolves the proposal notification", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Proposal" } }));
    const resolutions: unknown[] = [];

    await approveProposalCommand.run(
      makeCommandContext({
        storage,
        params: { ticket: ticket.shorthand },
        overrides: {
          notify: {
            resolve: async (input: unknown) => {
              resolutions.push(input);
              return [];
            },
          } as never,
        },
      }),
    );

    expect(resolutions).toEqual([{ dedupeKey: "pstdio-planner:ticket:T-1:proposal-refined", status: "done" }]);
  });
});

describe("breakIntoSubTicketsCommand", () => {
  test("starts a breakdown session from a row action", async () => {
    const sessions: unknown[] = [];

    await breakIntoSubTicketsCommand.run(
      makeCommandContext({
        storage: createMemoryStorage(),
        params: {
          rowId: "ticket-1",
          agent: { harnessId: "codex", model: "gpt-5" },
          template: "ticket",
        },
        overrides: {
          sessions: {
            create: async (input: unknown) => {
              sessions.push(input);
              return createSessionResource();
            },
          } as never,
        },
      }),
    );

    expect(sessions).toEqual([
      {
        anchors: [
          {
            type: "ticket",
            id: "ticket-1",
            projectId: "proj-1",
            extensionId: "pstdio-planner",
            label: "ticket-1",
            role: "primary",
            metadata: { shorthand: "ticket-1" },
          },
        ],
        title: "Break into sub-tickets: ticket-1",
        harness: { harnessId: "codex", model: "gpt-5" },
        template: "create-sub-tickets",
        vars: {
          ticket: "ticket-1",
          templateName: "ticket",
        },
      },
    ]);
  });
});
