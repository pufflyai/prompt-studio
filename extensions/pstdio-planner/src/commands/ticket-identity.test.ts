import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket, ticketsCollection } from "../data/collections";
import { makeCommandArgs, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { deleteTicketCommand } from "./delete-ticket";
import { migrateTicketIdentitiesCommand } from "./migrate-ticket-identities";
import { writeTicketCommand } from "./write-ticket";

const existingProject = async () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  const ticket = await putTicket(storage, {
    id: "existing-ticket",
    shorthand: "T-9",
    title: "Existing",
    content: "# Existing",
    statusId: null,
    archived: false,
    sortOrder: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  const context = makeCommandContext({ storage, params: {}, overrides: { projectFiles } });
  return { storage, projectFiles, ticket, context };
};

test("creating a ticket automatically migrates existing tickets and resolves supplied references", async () => {
  const { storage, projectFiles, ticket, context } = await existingProject();
  await projectFiles.writeText(".pstdio/tickets/T-9/ticket.md", "Unsaved edit");

  const created = await createTicketCommand.run(context, {
    title: "New",
    parent: "T-9",
    dependsOn: ["T-9"],
  });

  expect(created).toMatchObject({ shorthand: "T-2", parentId: ticket.id, dependsOn: [ticket.id] });
  expect((await ticketsCollection(storage).get(ticket.id))?.shorthand).toBe("T-1");
  expect(await projectFiles.readText(".pstdio/ticket-identity-migration/.pstdio/tickets/T-9/ticket.md")).toBe(
    "Unsaved edit",
  );
  expect((await createTicketCommand.run(context, { title: "Next" })).shorthand).toBe("T-3");
});

test("writing a draft automatically migrates existing tickets before allocating its identity", async () => {
  const { storage, projectFiles, ticket, context } = await existingProject();

  const draft = await writeTicketCommand.run(context, { title: "New draft", parent: "T-9" });

  expect(draft.shorthand).toBe("T-2");
  expect((await ticketsCollection(storage).get(ticket.id))?.shorthand).toBe("T-1");
  expect(await projectFiles.readText(".pstdio/tickets/T-2/ticket.md")).toContain('parent_id: "T-1"');
});

test("concurrent creation and explicit migration share one project migration", async () => {
  const { storage, projectFiles, ticket, context } = await existingProject();
  const create = () =>
    createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "New" }, overrides: { projectFiles } }));
  const [, ...created] = await Promise.all([
    migrateTicketIdentitiesCommand.run(context, {}),
    ...Array.from({ length: 5 }, create),
  ]);

  expect((await ticketsCollection(storage).get(ticket.id))?.shorthand).toBe("T-1");
  expect(created.map((value) => value.shorthand).sort()).toEqual(["T-2", "T-3", "T-4", "T-5", "T-6"]);
  expect(await ticketsCollection(storage).list()).toHaveLength(6);
});

test("ticket creation retries an interrupted migration without reallocating existing identities", async () => {
  const { storage, projectFiles, ticket, context } = await existingProject();
  let interrupted = false;
  const failingContext = makeCommandContext({
    storage,
    params: {},
    overrides: {
      projectFiles: {
        ...projectFiles,
        writeText: async () => {
          interrupted = true;
          throw new Error("File write interrupted");
        },
      },
    },
  });

  const params = { title: "New", parent: "T-9", dependsOn: ["T-9"] };
  await expect(createTicketCommand.run(failingContext, params)).rejects.toThrow("File write interrupted");
  expect(interrupted).toBe(true);
  expect(await ticketsCollection(storage).list()).toHaveLength(1);
  const created = await createTicketCommand.run(context, params);
  expect(created.shorthand).toBe("T-2");
  expect(created).toMatchObject({ parentId: ticket.id, dependsOn: [ticket.id] });
  expect((await ticketsCollection(storage).get(ticket.id))?.shorthand).toBe("T-1");
  expect(await projectFiles.readText(".pstdio/tickets/T-1/ticket.md")).toContain("# Existing");
});

test("deleted tickets do not free identities and concurrent creates are distinct", async () => {
  const storage = createMemoryStorage();
  const create = () => createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
  const first = await create();
  await ticketsCollection(storage).delete(first.id);
  const second = await create();
  expect(second.shorthand).toBe("T-2");
  const tickets = await Promise.all(Array.from({ length: 10 }, create));
  expect(new Set(tickets.map((ticket) => ticket.shorthand)).size).toBe(10);
});

test("deleting a ticket during migration does not block later ticket creation", async () => {
  const { storage, context, ticket } = await existingProject();
  const allocate = context.resources.allocate;
  context.resources.allocate = async (input) => {
    await deleteTicketCommand.run(
      { ...context, resources: { ...context.resources, removed: async () => {} } },
      { id: ticket.id },
    );
    return allocate(input);
  };
  const created = await createTicketCommand.run(context, { title: "New" });
  expect(created.shorthand).toBe("T-2");
  expect(await ticketsCollection(storage).get(ticket.id)).toBeUndefined();
  expect((await createTicketCommand.run(context, { title: "Next" })).shorthand).toBe("T-3");
});

test("saving an edit read before migration keeps the migrated ticket identity", async () => {
  const { storage, context, ticket } = await existingProject();
  await createTicketCommand.run(context, { title: "New" });
  await ticketsCollection(storage).update(ticket.id, { ...ticket, title: "Unsaved edit", content: "# Unsaved edit" });
  expect(await ticketsCollection(storage).get(ticket.id)).toMatchObject({
    shorthand: "T-1",
    title: "Unsaved edit",
    content: "# Unsaved edit",
  });
});

test.each([
  { status: "Invalid" },
  { dependsOn: ["Unknown"] },
])("invalid creation inputs do not renumber the supplied parent ($status $dependsOn)", async (invalid) => {
  const { storage, context, ticket } = await existingProject();
  await expect(createTicketCommand.run(context, { title: "New", parent: "T-9", ...invalid })).rejects.toThrow(
    "Unknown",
  );
  expect((await ticketsCollection(storage).get(ticket.id))?.shorthand).toBe("T-9");
  expect((await createTicketCommand.run(context, { title: "New", parent: "T-9" })).parentId).toBe(ticket.id);
});
