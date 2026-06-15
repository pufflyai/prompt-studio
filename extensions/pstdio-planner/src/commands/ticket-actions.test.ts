import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { breakIntoSubTicketsCommand, createWorkspaceCommand, runAttemptCommand } from "./ticket-actions";

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
        { label: "Worktree", value: "worktree" },
        { label: "Current branch", value: "current_branch" },
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

    expect(result).toEqual({
      mode: "worktree",
      ticket,
      workspace: { id: "workspace-1", workspace_shorthand: "T-1_A1" },
      session: { ...createSessionResource(), workspace_id: "workspace-1" },
    });
    expect((await ticketsCollection(storage).get(ticket.id))?.statusId).toBe("default-in-progress");
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
            metadata: { shorthand: "T-1" },
          },
        ],
        mode: "worktree",
        project_id: "proj-1",
        shorthand_base: "T-1",
      },
    ]);
    expect(sessions).toEqual([
      {
        anchors: [
          {
            type: "ticket",
            id: ticket.id,
            projectId: "proj-1",
            extensionId: "pstdio-planner",
            label: "T-1",
            role: "primary",
            metadata: { shorthand: "T-1" },
          },
        ],
        prompt: "Implement ticket: T-1",
        title: "Implement ticket: T-1",
        workspaceId: "workspace-1",
      },
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
        base: "main",
        mode: "current_branch",
        project_id: "proj-1",
        repo_id: "repo-1",
        shorthand_base: "PS-304",
      },
    ]);
    expect(sessions).toEqual([
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
        harness: { harnessId: "codex", model: "gpt-5" },
        prompt: "Implement ticket: PS-304",
        title: "Implement ticket: PS-304",
        workspaceId: "workspace-1",
      },
    ]);
  });

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
            metadata: { shorthand: "T-1" },
          },
        ],
        mode: "worktree",
        project_id: "proj-1",
        shorthand_base: "T-1",
      },
    ]);
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
            metadata: { shorthand: "T-1" },
          },
        ],
        mode: "worktree",
        project_id: "proj-1",
        shorthand_base: "T-1",
      },
    ]);
    expect(sessions).toEqual([]);
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
