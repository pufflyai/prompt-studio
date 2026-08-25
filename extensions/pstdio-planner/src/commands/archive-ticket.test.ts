import { describe, expect, test } from "bun:test";
import { putTicket, ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import type { StoredTicket } from "../data/types";
import { archiveTicketColumnActionCommand, archiveTicketCommand } from "./archive-ticket";
import { makeCommandArgs } from "./command-context.fixture";

const now = "2026-06-08T10:00:00.000Z";

const makeTicket = (overrides: Partial<StoredTicket> = {}) =>
  ({
    id: "ticket-1",
    shorthand: "T-1",
    title: "Ticket",
    content: "# Ticket",
    statusId: "backlog",
    tagIds: [],
    attachments: [],
    files: [],
    parentId: null,
    dependsOn: null,
    blockedReason: null,
    userPrompt: null,
    parallelizable: null,
    draft: false,
    archived: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }) satisfies StoredTicket;

const seedTicket = (storage: ReturnType<typeof createMemoryStorage>) => putTicket(storage, makeTicket());

const ticketAnchor = (shorthand: string, id: string) => ({
  type: "ticket",
  id,
  label: shorthand,
  metadata: { shorthand },
});

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("archive ticket", () => {
  test("archives the ticket and cascades to its linked workspaces only", async () => {
    const storage = createMemoryStorage();
    await seedTicket(storage);

    const archived: string[] = [];
    const workspaces = [
      { id: "ws-1", workspace_shorthand: "T-1_A1", anchors_json: [ticketAnchor("T-1", "ticket-1")] },
      { id: "ws-2", workspace_shorthand: "T-1_A2", anchors_json: [ticketAnchor("T-1", "ticket-1")] },
      { id: "ws-other", workspace_shorthand: "T-2_A1", anchors_json: [ticketAnchor("T-2", "ticket-2")] },
    ];

    const result = (await archiveTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: "T-1" },
        overrides: {
          workspaces: {
            list: async () => workspaces,
            archive: async (id: string) => {
              archived.push(id);
            },
          },
        },
      }),
    )) as StoredTicket | null;

    expect(result?.archived).toBe(true);
    expect((await ticketsCollection(storage).get("ticket-1"))?.archived).toBe(true);
    expect(archived.sort()).toEqual(["ws-1", "ws-2"]);
  });

  test("archive ticket waits for linked workspace cascade to settle", async () => {
    const storage = createMemoryStorage();
    await seedTicket(storage);

    const archiveStarted = deferred();
    const cascadeSettled = deferred();
    const archived: string[] = [];
    const workspaces = [{ id: "ws-1", workspace_shorthand: "T-1_A1", anchors_json: [ticketAnchor("T-1", "ticket-1")] }];

    let commandResolved = false;
    const command = Promise.resolve(
      archiveTicketCommand.run!(
        ...makeCommandArgs({
          storage,
          params: { id: "T-1" },
          overrides: {
            workspaces: {
              list: async () => workspaces,
              archive: async (id: string) => {
                archiveStarted.resolve();
                await cascadeSettled.promise;
                archived.push(id);
              },
            },
          },
        }),
      ),
    ).then((result) => {
      commandResolved = true;
      return result as StoredTicket | null;
    });

    await archiveStarted.promise;
    await Promise.resolve();

    expect(commandResolved).toBe(false);
    expect(archived).toEqual([]);

    cascadeSettled.resolve();
    const result = await command;

    expect(result?.archived).toBe(true);
    expect(archived).toEqual(["ws-1"]);
  });

  test("archive all column action archives every ticket in the selected column", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({ id: "ticket-1", shorthand: "T-1", statusId: "done", sortOrder: 1 }));
    await putTicket(storage, makeTicket({ id: "ticket-2", shorthand: "T-2", statusId: "done", sortOrder: 2 }));
    await putTicket(storage, makeTicket({ id: "ticket-3", shorthand: "T-3", statusId: "in-progress", sortOrder: 3 }));

    const archived: string[] = [];
    const workspaces = [
      { id: "ws-1", workspace_shorthand: "T-1_A1", anchors_json: [ticketAnchor("T-1", "ticket-1")] },
      { id: "ws-2", workspace_shorthand: "T-2_A1", anchors_json: [ticketAnchor("T-2", "ticket-2")] },
      { id: "ws-other", workspace_shorthand: "T-3_A1", anchors_json: [ticketAnchor("T-3", "ticket-3")] },
    ];

    const result = (await archiveTicketColumnActionCommand.run(
      ...makeCommandArgs({
        storage,
        params: { columnId: "done", actionId: "archive_all" },
        overrides: {
          workspaces: {
            list: async () => workspaces,
            archive: async (id: string) => {
              archived.push(id);
            },
          },
        },
      }),
    )) as { archived: StoredTicket[] };

    expect(result.archived.map((ticket) => ticket.id).sort()).toEqual(["ticket-1", "ticket-2"]);
    expect((await ticketsCollection(storage).get("ticket-1"))?.archived).toBe(true);
    expect((await ticketsCollection(storage).get("ticket-2"))?.archived).toBe(true);
    expect((await ticketsCollection(storage).get("ticket-3"))?.archived).toBe(false);
    expect(archived.sort()).toEqual(["ws-1", "ws-2"]);
  });

  test("archive all column action resolves before workspace cascade settles", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({ id: "ticket-1", shorthand: "T-1", statusId: "default-done" }));

    const archiveStarted = deferred();
    const cascadeSettled = deferred();
    const workspaces = [{ id: "ws-1", workspace_shorthand: "T-1_A1", anchors_json: [ticketAnchor("T-1", "ticket-1")] }];

    let commandResolved = false;
    const command = Promise.resolve(
      archiveTicketColumnActionCommand.run(
        ...makeCommandArgs({
          storage,
          params: { columnId: "default-done", actionId: "archive_all" },
          overrides: {
            workspaces: {
              list: async () => workspaces,
              archive: async () => {
                archiveStarted.resolve();
                await cascadeSettled.promise;
              },
            },
          },
        }),
      ),
    ).then((result) => {
      commandResolved = true;
      return result as { archived: StoredTicket[] };
    });

    await archiveStarted.promise;
    await Promise.resolve();

    const resolvedBeforeCascade = commandResolved;
    cascadeSettled.resolve();
    const result = await command;

    expect(resolvedBeforeCascade).toBe(true);
    expect(result.archived.map((ticket) => ticket.id)).toEqual(["ticket-1"]);
    expect((await ticketsCollection(storage).get("ticket-1"))?.archived).toBe(true);
  });

  test("archive all column action keeps ticket archival when linked workspace archive fails", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({ id: "ticket-1", shorthand: "T-1", statusId: "default-done" }));

    const notifications: unknown[] = [];
    const notificationPosted = deferred();
    const workspaces = [{ id: "ws-1", workspace_shorthand: "T-1_A1", anchors_json: [ticketAnchor("T-1", "ticket-1")] }];

    const result = (await archiveTicketColumnActionCommand.run(
      ...makeCommandArgs({
        storage,
        params: { columnId: "default-done", actionId: "archive_all" },
        overrides: {
          workspaces: {
            list: async () => workspaces,
            archive: async () => {
              throw new Error("cascade failed");
            },
          },
          notify: {
            action: async (input: unknown) => {
              notifications.push(input);
              notificationPosted.resolve();
              return {};
            },
          } as never,
        },
      }),
    )) as { archived: StoredTicket[] };

    await notificationPosted.promise;

    expect(result.archived.map((ticket) => ticket.id)).toEqual(["ticket-1"]);
    expect((await ticketsCollection(storage).get("ticket-1"))?.archived).toBe(true);
    expect(notifications).toEqual([
      {
        title: "Workspace cleanup failed",
        body: "Linked workspace cleanup failed after archiving the ticket: cascade failed",
        kind: "failed",
        priority: "normal",
      },
    ]);
  });

  test("archive ticket keeps ticket archival when linked workspace archive fails", async () => {
    const storage = createMemoryStorage();
    await seedTicket(storage);

    const notifications: unknown[] = [];
    const workspaces = [{ id: "ws-1", workspace_shorthand: "T-1_A1", anchors_json: [ticketAnchor("T-1", "ticket-1")] }];

    const result = (await archiveTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: "T-1" },
        overrides: {
          workspaces: {
            list: async () => workspaces,
            archive: async () => {
              throw new Error("cascade failed");
            },
          },
          notify: {
            action: async (input: unknown) => {
              notifications.push(input);
              return {};
            },
          } as never,
        },
      }),
    )) as StoredTicket | null;

    expect(result?.archived).toBe(true);
    expect((await ticketsCollection(storage).get("ticket-1"))?.archived).toBe(true);
    expect(notifications).toEqual([
      {
        title: "Workspace cleanup failed",
        body: "Linked workspace cleanup failed after archiving the ticket: cascade failed",
        kind: "failed",
        priority: "normal",
      },
    ]);
  });
});
