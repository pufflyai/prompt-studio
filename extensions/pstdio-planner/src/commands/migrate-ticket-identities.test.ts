import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket, ticketsCollection } from "../data/collections";
import { makeCommandArgs, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { migrateTicketIdentitiesCommand } from "./migrate-ticket-identities";

test("migration renumbers saved tickets, backs up local files, refreshes anchors, and resumes safely", async () => {
  const storage = createMemoryStorage();
  const repoFiles = createMemoryRepoFiles();
  const original = await putTicket(storage, {
    id: "old-ticket",
    shorthand: "T-9",
    title: "Ticket",
    content: "# Ticket",
    statusId: null,
    archived: false,
    sortOrder: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  await repoFiles.writeText(".pstdio/tickets/T-9/ticket.md", "Unsaved local content");
  await repoFiles.writeText(".pstdio/tickets/T-8/ticket.md", "Orphan");
  const anchors: unknown[] = [];
  const context = makeCommandContext({
    storage,
    params: {},
    overrides: {
      repoFiles,
      sessions: {
        list: async () => [
          {
            id: "session",
            title: "Session",
            status: "completed",
            anchors_json: [{ type: "ticket", id: original.id, label: original.shorthand }],
          },
        ],
        addAnchors: async (_id, next) => {
          anchors.push(...next);
        },
      },
    },
  });
  await expect(createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "New" } }))).rejects.toThrow(
    "migrate-ticket-identities",
  );
  const result = await migrateTicketIdentitiesCommand.run(context, {});
  expect(result).toMatchObject({
    complete: true,
    migrated: 1,
    identities: [{ id: original.id, previousShorthand: "T-9", shorthand: "T-1" }],
  });
  expect((await ticketsCollection(storage).get(original.id))?.shorthand).toBe("T-1");
  expect(await repoFiles.exists(".pstdio/tickets/T-9/ticket.md")).toBe(false);
  expect(await repoFiles.exists(".pstdio/tickets/T-8/ticket.md")).toBe(false);
  expect(await repoFiles.readText(".pstdio/ticket-identity-migration/.pstdio/tickets/T-9/ticket.md")).toBe(
    "Unsaved local content",
  );
  expect(await repoFiles.readText(".pstdio/tickets/T-1/ticket.md")).toContain("# Ticket");
  expect(anchors).toContainEqual(expect.objectContaining({ id: original.id, shorthand: "T-1" }));
  expect(await migrateTicketIdentitiesCommand.run(context, {})).toMatchObject({ migrated: 0 });
  const created = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "New" } }));
  expect(created.shorthand).toBe("T-2");
});

test("interrupted file rewrite resumes with the original allocation and backup", async () => {
  const storage = createMemoryStorage();
  const repoFiles = createMemoryRepoFiles();
  await putTicket(storage, {
    id: "original",
    shorthand: "T-8",
    title: "Saved",
    content: "# Saved",
    statusId: null,
    archived: false,
    sortOrder: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  await repoFiles.writeText(".pstdio/tickets/T-8/ticket.md", "local edit");
  let fail = true;
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      repoFiles: {
        ...repoFiles,
        writeText: async (path, content) => {
          if (fail) {
            fail = false;
            throw new Error("interrupted");
          }
          await repoFiles.writeText(path, content);
        },
      },
    },
  });
  await expect(migrateTicketIdentitiesCommand.run(ctx, {})).rejects.toThrow("interrupted");
  expect((await ticketsCollection(storage).get("original"))?.shorthand).toBe("T-1");
  await expect(
    createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Too early" } })),
  ).rejects.toThrow("migrate-ticket-identities");
  await migrateTicketIdentitiesCommand.run(ctx, {});
  expect((await ticketsCollection(storage).get("original"))?.shorthand).toBe("T-1");
  expect(await repoFiles.readText(".pstdio/ticket-identity-migration/.pstdio/tickets/T-8/ticket.md")).toBe(
    "local edit",
  );
  expect((await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Next" } }))).shorthand).toBe(
    "T-2",
  );
});
