import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { humanRequestsCollection, putAttempt } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { ticketsCollection } from "../data/collections";
import { seedDefaultTags } from "../data/seed";
import { createSessionResource, makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { runAttemptCommand } from "./run-attempt";

const runningAttempt = (workspaceId: string): AttemptRecord => ({
  schemaVersion: 1,
  workspaceId,
  workspaceShorthand: workspaceId,
  ticketId: `ticket-${workspaceId}`,
  ticketShorthand: `T-${workspaceId}`,
  implementationSessionId: `session-${workspaceId}`,
  state: "implementing",
  base: { workspaceId: null, headSha: "main-sha" },
  revisions: [],
  implementationDisconnectRetries: 0,
  reviewDisconnectRetries: 0,
  blocker: null,
  createdAt: "2026-10-02T09:00:00.000Z",
  updatedAt: "2026-10-02T09:00:00.000Z",
});

describe("runAttemptCommand", () => {
  test("creates an anchored workspace and session with the ticket shorthand in the prompt", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
    const storedTicket = await ticketsCollection(storage).get(ticket.id);
    if (!storedTicket) {
      throw new Error("Expected the created ticket to be stored");
    }
    const workspaces: unknown[] = [];
    const sessions: unknown[] = [];

    const result = await runAttemptCommand.run(
      ...makeCommandArgs({
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
      ticket: storedTicket,
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
            shorthand: "T-1",
            metadata: {
              resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
            },
          },
        ],
        params: { base: "main-sha" },
        provider_id: "pstdio.worktree",
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
            shorthand: "T-1",
            metadata: {
              resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
            },
          },
          expect.objectContaining({ type: "planner-attempt", id: "workspace-1" }),
        ]),
        prompt: expect.stringContaining("T-1"),
        title: "Implement ticket: T-1",
        workspaceId: "workspace-1",
      }),
    ]);
  });

  test("preserves explicit agent and Git base parameters", async () => {
    const workspaces: unknown[] = [];
    const sessions: unknown[] = [];
    const commands: string[][] = [];

    await runAttemptCommand.run(
      ...makeCommandArgs({
        storage: createMemoryStorage(),
        params: {
          ticket: "PS-304",
          agent: { harnessId: "codex", model: "gpt-5" },
          workspace: { providerId: "pstdio.worktree", params: { base: "main" } },
        },
        overrides: {
          process: {
            run: async (input: { command: string[] }) => {
              commands.push(input.command);
              return { exitCode: 0, stdout: "main-sha\n", stderr: "" };
            },
          } as never,
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
            shorthand: "PS-304",
            metadata: {},
          },
        ],
        params: { base: "main-sha" },
        provider_id: "pstdio.worktree",
        project_id: "proj-1",
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
            shorthand: "PS-304",
            metadata: {},
          },
          expect.objectContaining({ type: "planner-attempt", id: "workspace-1" }),
        ]),
        harness: { harnessId: "codex", model: "gpt-5" },
        prompt: expect.stringContaining("PS-304"),
        title: "Implement ticket: PS-304",
        workspaceId: "workspace-1",
      }),
    ]);
    expect(commands).toContainEqual(expect.arrayContaining(["rev-parse", "main^{commit}"]));
  });
});

describe("runAttemptCommand guarded launches", () => {
  test("falls back to the row id when the ticket param is empty", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
    const workspaces: unknown[] = [];

    await runAttemptCommand.run(
      ...makeCommandArgs({
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
            shorthand: "T-1",
            metadata: {
              resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
            },
          },
        ],
        params: { base: "main-sha" },
        provider_id: "pstdio.worktree",
        project_id: "proj-1",
        shorthand_base: "T-1",
      },
    ]);
  });

  test("creates at most one attempt for concurrent launch decisions", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
    let releaseWorkspace!: () => void;
    const workspaceGate = new Promise<void>((resolve) => {
      releaseWorkspace = resolve;
    });
    let creates = 0;
    const context = () =>
      makeCommandArgs({
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

    const pending = Promise.allSettled([runAttemptCommand.run(...context()), runAttemptCommand.run(...context())]);
    await Promise.resolve();
    releaseWorkspace();
    const results = await pending;

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "rejected",
          reason: expect.objectContaining({ message: expect.stringContaining("T-1") }),
        }),
        expect.objectContaining({ status: "fulfilled", value: expect.objectContaining({ decision: "started" }) }),
      ]),
    );
    expect(creates).toBe(1);
  });

  test("fails with the unfinished dependency named and starts nothing", async () => {
    const storage = createMemoryStorage();
    const dependency = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const ticket = await createTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Second", dependsOn: [dependency.shorthand] } }),
    );
    let creates = 0;

    await expect(
      runAttemptCommand.run(
        ...makeCommandArgs({
          storage,
          params: { ticket: ticket.shorthand },
          overrides: {
            workspaces: {
              create: async () => {
                creates += 1;
                return { id: "workspace-1", workspace_shorthand: "T-2_A1" };
              },
            } as never,
          },
        }),
      ),
    ).rejects.toThrow(dependency.shorthand);
    expect(creates).toBe(0);
  });

  test("fails while every attempt slot is in use", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
    for (const workspaceId of ["running-1", "running-2"]) {
      await putAttempt(storage, runningAttempt(workspaceId));
    }

    await expect(
      runAttemptCommand.run(
        ...makeCommandArgs({
          storage,
          params: { ticket: ticket.shorthand },
          overrides: { sessions: { get: async () => createSessionResource() } as never },
        }),
      ),
    ).rejects.toThrow("2 attempts");
  });
});

describe("runAttemptCommand human requests", () => {
  const ticketWithDeletedDependency = async () => {
    const storage = createMemoryStorage();
    await seedDefaultTags(storage);
    const dependency = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const ticket = await createTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Second", dependsOn: [dependency.shorthand] } }),
    );
    await ticketsCollection(storage).delete(dependency.id);
    return { storage, ticket };
  };

  test("asks a person to fix a dependency that no longer exists", async () => {
    const { storage, ticket } = await ticketWithDeletedDependency();

    await expect(
      runAttemptCommand.run(
        ...makeCommandArgs({
          storage,
          params: { ticket: ticket.shorthand },
          overrides: { sessions: { create: async () => createSessionResource() } as never },
        }),
      ),
    ).rejects.toThrow(ticket.shorthand);
    expect(await humanRequestsCollection(storage).list()).toEqual([
      expect.objectContaining({ ticketId: ticket.id, reason: "dependency-missing", state: "open" }),
    ]);
  });

  test("still reports why the ticket cannot start when the human request fails", async () => {
    const { storage, ticket } = await ticketWithDeletedDependency();

    const run = runAttemptCommand.run(
      ...makeCommandArgs({
        storage,
        params: { ticket: ticket.shorthand },
        overrides: {
          sessions: {
            create: async () => {
              throw new Error("No default agent is configured.");
            },
          } as never,
        },
      }),
    );

    await expect(run).rejects.toThrow(`${ticket.shorthand} can't start`);
  });
});
