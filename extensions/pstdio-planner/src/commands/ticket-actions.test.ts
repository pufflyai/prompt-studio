import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { createSessionResource, makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import {
  approveProposalCommand,
  breakIntoSubTicketsCommand,
  createWorkspaceCommand,
  proposalRefinedCommand,
  refineTicketCommand,
} from "./ticket-actions";

describe("createWorkspaceCommand", () => {
  test("creates an anchored workspace for the ticket without starting a session", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
    const storedTicket = await ticketsCollection(storage).get(ticket.id);
    if (!storedTicket) {
      throw new Error("Expected the created ticket to be stored");
    }
    const workspaces: unknown[] = [];
    const sessions: unknown[] = [];

    const result = await createWorkspaceCommand.run(
      ...makeCommandArgs({
        storage,
        params: { rowId: ticket.id, provider_id: "pstdio.worktree", params: { base: "HEAD" } },
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
      ticket: storedTicket,
      workspace: { id: "workspace-1", workspace_shorthand: "T-1_A1" },
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
            shorthand: "T-1",
            metadata: {
              resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
            },
          },
        ],
        params: { base: "HEAD" },
        provider_id: "pstdio.worktree",
        project_id: "proj-1",
        shorthand_base: "T-1",
      },
    ]);
    expect(sessions).toEqual([]);
  });

  test("stores ticket ancestry on created workspace anchors", async () => {
    const storage = createMemoryStorage();
    const parent = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Parent" } }));
    const child = await createTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Child", parentId: parent.id } }),
    );
    const workspaces: unknown[] = [];

    await createWorkspaceCommand.run(
      ...makeCommandArgs({
        storage,
        params: { rowId: child.id, provider_id: "pstdio.worktree" },
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
            shorthand: child.shorthand,
            metadata: {
              resourceParent: {
                type: "ticket",
                id: parent.id,
                label: `${parent.shorthand} Parent`,
                shorthand: parent.shorthand,
                metadata: {
                  resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
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
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Proposal" } }));
    const notifications: unknown[] = [];

    await refineTicketCommand.run(
      ...makeCommandArgs({
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
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Proposal" } }));
    const notifications: unknown[] = [];

    await proposalRefinedCommand.run(
      ...makeCommandArgs({
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
          expect.objectContaining({ command: "pstdio.pstdio-planner.command.approve-proposal", label: "Approve" }),
        ]),
        dedupeKey: "pstdio-planner:ticket:T-1:proposal-refined",
        kind: "needs_review",
        target: expect.objectContaining({ id: ticket.id, type: "ticket" }),
      }),
    ]);
  });

  test("approve proposal resolves the proposal notification", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Proposal" } }));
    const resolutions: unknown[] = [];

    await approveProposalCommand.run(
      ...makeCommandArgs({
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
      ...makeCommandArgs({
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
            shorthand: "ticket-1",
            metadata: {},
          },
        ],
        title: "Break into sub-tickets: ticket-1",
        harness: { harnessId: "codex", model: "gpt-5" },
        prompt: expect.stringContaining("ticket-1"),
      },
    ]);
  });
});
