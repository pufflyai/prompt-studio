import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket, ticketsCollection } from "../data/collections";
import { makeCommandArgs, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { migrateTicketIdentitiesCommand } from "./migrate-ticket-identities";

test("migration renumbers saved tickets, backs up local files, refreshes anchors, and resumes safely", async () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
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
  await projectFiles.writeText(".pstdio/tickets/T-9/ticket.md", "Unsaved local content");
  await projectFiles.writeText(".pstdio/tickets/T-8/ticket.md", "Orphan");
  const anchors: unknown[] = [];
  const context = makeCommandContext({
    storage,
    params: {},
    overrides: {
      projectFiles,
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
  const result = await migrateTicketIdentitiesCommand.run(context, {});
  expect(result).toMatchObject({
    complete: true,
    migrated: 1,
    identities: [{ id: original.id, previousShorthand: "T-9", shorthand: "T-1" }],
  });
  expect((await ticketsCollection(storage).get(original.id))?.shorthand).toBe("T-1");
  expect(await projectFiles.exists(".pstdio/tickets/T-9/ticket.md")).toBe(false);
  expect(await projectFiles.exists(".pstdio/tickets/T-8/ticket.md")).toBe(false);
  expect(await projectFiles.readText(".pstdio/ticket-identity-migration/.pstdio/tickets/T-9/ticket.md")).toBe(
    "Unsaved local content",
  );
  expect(await projectFiles.readText(".pstdio/tickets/T-1/ticket.md")).toContain("Unsaved local content");
  expect(anchors).toContainEqual(expect.objectContaining({ id: original.id, shorthand: "T-1" }));
  expect(await migrateTicketIdentitiesCommand.run(context, {})).toMatchObject({ migrated: 0 });
  const created = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "New" } }));
  expect(created.shorthand).toBe("T-2");
});

test("migration carries unsaved draft fields, references, and binary files into the new ticket paths", async () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  for (const [id, shorthand, sortOrder] of [
    ["parent", "T-8", 0],
    ["child", "T-9", 1],
  ] as const) {
    await putTicket(storage, {
      id,
      shorthand,
      sortOrder,
      title: "Saved",
      content: "# Saved",
      statusId: null,
      archived: false,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
  }
  await projectFiles.writeText(
    ".pstdio/tickets/T-9/ticket.md",
    [
      "---",
      'ticket_id: "T-9"',
      ' parent_id : "T-8"',
      'depends_on: ["T-8"]',
      'tags: ["High"]',
      'user_prompt: "Keep this edit"',
      "draft: true",
      "---",
      "",
      "# Unsaved title",
    ].join("\n"),
  );
  const bytes = new Uint8Array([0, 255, 128, 42]);
  await projectFiles.writeBytes(".pstdio/tickets/T-9/files/sketch.bin", bytes);

  await migrateTicketIdentitiesCommand.run(
    makeCommandContext({ storage, params: {}, overrides: { projectFiles } }),
    {},
  );

  const content = await projectFiles.readText(".pstdio/tickets/T-2/ticket.md");
  expect(content).toContain('ticket_id: "T-2"');
  expect(content).toContain('parent_id: "T-1"');
  expect(content).toContain('depends_on: ["T-1"]');
  expect(content).toContain('user_prompt: "Keep this edit"');
  expect(content).toContain('tags: ["High"]');
  expect(content).toContain("draft: true");
  expect(content).toContain("# Unsaved title");
  expect(await projectFiles.readBytes(".pstdio/tickets/T-2/files/sketch.bin")).toEqual(bytes);
});

test("interrupted file rewrite resumes with the original allocation and backup", async () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
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
  await projectFiles.writeText(".pstdio/tickets/T-8/ticket.md", "local edit");
  let fail = true;
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      projectFiles: {
        ...projectFiles,
        writeText: async (path, content) => {
          if (fail) {
            fail = false;
            throw new Error("interrupted");
          }
          await projectFiles.writeText(path, content);
        },
      },
    },
  });
  await expect(migrateTicketIdentitiesCommand.run(ctx, {})).rejects.toThrow("interrupted");
  expect((await ticketsCollection(storage).get("original"))?.shorthand).toBe("T-1");
  await migrateTicketIdentitiesCommand.run(ctx, {});
  expect((await ticketsCollection(storage).get("original"))?.shorthand).toBe("T-1");
  expect(await projectFiles.readText(".pstdio/ticket-identity-migration/.pstdio/tickets/T-8/ticket.md")).toBe(
    "local edit",
  );
  expect((await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Next" } }))).shorthand).toBe(
    "T-2",
  );
});

test("migration completes for a project that has no local ticket drafts", async () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  const original = await putTicket(storage, {
    id: "dashboard-ticket",
    shorthand: "T-9",
    title: "Created from the dashboard",
    content: "# Created from the dashboard",
    statusId: null,
    archived: false,
    sortOrder: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  const context = makeCommandContext({ storage, params: {}, overrides: { projectFiles } });

  expect(await migrateTicketIdentitiesCommand.run(context, {})).toMatchObject({ complete: true, migrated: 1 });
  expect((await ticketsCollection(storage).get(original.id))?.shorthand).toBe("T-1");
  expect(await projectFiles.readText(".pstdio/tickets/T-1/ticket.md")).toContain("# Created from the dashboard");
  expect((await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "New" } }))).shorthand).toBe(
    "T-2",
  );
});

test("retry after rewriting drafts does not mistake a new path for an original checkout", async () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  for (const [id, shorthand, sortOrder] of [
    ["first", "T-2", 0],
    ["second", "T-9", 1],
  ] as const) {
    await putTicket(storage, {
      id,
      shorthand,
      sortOrder,
      title: id,
      content: `# ${id}`,
      statusId: null,
      archived: false,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
  }
  await projectFiles.writeText(".pstdio/tickets/T-9/ticket.md", "# Edited second");
  const interrupted = makeCommandContext({
    storage,
    params: {},
    overrides: {
      projectFiles,
      sessions: {
        list: async () => {
          throw new Error("Interrupted anchor refresh");
        },
      },
    },
  });
  await expect(migrateTicketIdentitiesCommand.run(interrupted, {})).rejects.toThrow("Interrupted anchor refresh");
  const context = makeCommandContext({ storage, params: {}, overrides: { projectFiles } });
  await migrateTicketIdentitiesCommand.run(context, {});
  expect(await projectFiles.readText(".pstdio/tickets/T-1/ticket.md")).toContain("# first");
  expect(await projectFiles.readText(".pstdio/tickets/T-2/ticket.md")).toContain("# Edited second");
  expect(await projectFiles.exists(".pstdio/ticket-identity-migration/.pstdio/tickets/T-2/ticket.md")).toBe(false);
});
