import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/ticket-context.fixture";
import { prepareArchiveContext } from "./archive-context.fixture";
import { archiveTicketColumnAction } from "./archive-ticket";
import { makeCommandArgs, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const seedColumn = async (count: number) => {
  const storage = createMemoryStorage();
  const tickets = [];
  for (let index = 0; index < count; index++) {
    tickets.push(
      await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: `Ticket ${index + 1}` } })),
    );
  }
  const workspaces = tickets.map((ticket) => ({
    id: `workspace-${ticket.id}`,
    anchors_json: [{ type: "ticket", id: ticket.id, shorthand: ticket.shorthand }],
  }));
  return { storage, tickets, workspaces, columnId: tickets[0].statusId! };
};

test("bulk archives 28 tickets before host workspace cleanup completes", async () => {
  const { storage, tickets, workspaces, columnId } = await seedColumn(28);
  const cleanupStarted = deferred();
  const releaseCleanup = deferred();
  const cleanupFinished = deferred();
  const deleted: string[] = [];
  let changed = false;
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      events: {
        emit: async () => {
          changed = true;
          return { delivered: 0 };
        },
      },
      workspaces: {
        list: async () => workspaces,
        delete: async (id) => {
          cleanupStarted.resolve();
          await releaseCleanup.promise;
          deleted.push(id);
          if (deleted.length === workspaces.length) cleanupFinished.resolve();
        },
      },
    },
  });

  await prepareArchiveContext(ctx);
  const command = archiveTicketColumnAction(ctx, { columnId, actionId: "archive_all" });
  try {
    const result = await command;
    await cleanupStarted.promise;

    expect(result.archivedCount).toBe(tickets.length);
    expect((await ticketsCollection(storage).list()).every((ticket) => ticket.archived)).toBe(true);
    expect(changed).toBe(true);
    expect(deleted).toEqual([]);
  } finally {
    releaseCleanup.resolve();
    await cleanupFinished.promise;
  }

  expect(deleted.sort()).toEqual(workspaces.map((workspace) => workspace.id).sort());
});

test("bulk cleanup attempts every workspace and reports all deletion failures", async () => {
  const { storage, workspaces, columnId } = await seedColumn(4);
  const notificationPosted = deferred();
  const attempted: string[] = [];
  const deleted: string[] = [];
  const notifications: unknown[] = [];
  const failedIds = new Set([workspaces[0].id, workspaces[2].id]);
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      workspaces: {
        list: async () => workspaces,
        delete: async (id) => {
          attempted.push(id);
          if (failedIds.has(id)) throw new Error(`Cannot delete ${id}`);
          deleted.push(id);
        },
      },
      notify: {
        action: async (notification: unknown) => {
          notifications.push(notification);
          notificationPosted.resolve();
        },
      } as never,
    },
  });

  await prepareArchiveContext(ctx);
  await archiveTicketColumnAction(ctx, { columnId, actionId: "archive_all" });
  await notificationPosted.promise;

  expect(attempted.sort()).toEqual(workspaces.map((workspace) => workspace.id).sort());
  expect(deleted.sort()).toEqual([workspaces[1].id, workspaces[3].id].sort());
  expect((await ticketsCollection(storage).list()).every((ticket) => ticket.archived)).toBe(true);
  expect(notifications).toEqual([
    expect.objectContaining({
      kind: "failed",
      body: expect.stringContaining(`Cannot delete ${workspaces[0].id}`),
    }),
  ]);
  expect((notifications[0] as { body: string }).body).toContain(`Cannot delete ${workspaces[2].id}`);
});
