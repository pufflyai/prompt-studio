import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { observeStorageReads } from "../data/storage-reads.fixture";
import { ticketContext, ticketsCollection } from "../data/ticket-context.fixture";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { resolveTicketResourcesCommand } from "./resolve-ticket-resources";
import { createTicketFileCommand, renameTicketFileCommand } from "./ticket-files";

test("resolves a saved document identity to its current name, body parent, and ticket ancestry", async () => {
  const storage = createMemoryStorage();
  const parent = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Parent" } }));
  const ticket = await createTicketCommand.run(
    ...makeCommandArgs({ storage, params: { title: "Child", parentId: parent.id } }),
  );
  const file = await createTicketFileCommand.run(
    ...makeCommandArgs({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
  );
  const observed = observeStorageReads(storage);
  const resources = [{ type: "ticket", id: ticket.id, metadata: { documentId: file.id } }];
  const resolve = () =>
    resolveTicketResourcesCommand.run(
      ...makeCommandArgs({
        storage: observed.storage,
        params: { resources },
        overrides: { resources: ticketContext(storage).resources },
      }),
    );
  expect(await resolve()).toMatchObject([
    {
      resource: { id: ticket.id, label: "notes.md", icon: "FileText", metadata: { documentId: file.id } },
      target: {
        parent: {
          resource: { id: ticket.id, label: `${ticket.shorthand} Child` },
          parent: { resource: { id: parent.id } },
        },
      },
    },
  ]);
  expect(observed.reads).toEqual([`tickets/${ticket.id}`, `tickets/${parent.id}`]);
  await renameTicketFileCommand.run(
    ...makeCommandArgs({ storage, params: { ticketId: ticket.id, fileId: file.id, name: "renamed" } }),
  );
  expect(await resolve()).toMatchObject([{ resource: { label: "renamed.md", metadata: { documentId: file.id } } }]);
  expect(
    await resolveTicketResourcesCommand.run(
      ...makeCommandArgs({ storage, params: { resources: [{ type: "ticket", id: ticket.id }] } }),
    ),
  ).toMatchObject([
    {
      resource: { label: `${ticket.shorthand} Child`, icon: "component" },
      target: { parent: { resource: { id: parent.id } } },
    },
  ]);
});

test("does not resolve a missing document as the ticket body", async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
  expect(
    await resolveTicketResourcesCommand.run(
      ...makeCommandArgs({
        storage,
        params: {
          resources: [
            { type: "ticket", id: ticket.id, metadata: { documentId: "deleted-file" } },
            { type: "ticket", id: "deleted-ticket" },
          ],
        },
      }),
    ),
  ).toEqual([]);
});

test("batch resolution reads a shared ancestor once and stops at cycles", async () => {
  const storage = createMemoryStorage();
  const parent = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Parent" } }));
  const child = await createTicketCommand.run(
    ...makeCommandArgs({ storage, params: { title: "Child", parentId: parent.id } }),
  );
  await ticketsCollection(storage).put(parent.id, { ...parent, parentId: child.id });
  const observed = observeStorageReads(storage);
  const resources = [
    { type: "ticket", id: child.id },
    { type: "ticket", id: parent.id },
    { type: "ticket", id: child.id },
  ];

  const resolved = await resolveTicketResourcesCommand.run(
    ...makeCommandArgs({
      storage: observed.storage,
      params: { resources },
      overrides: { resources: ticketContext(storage).resources },
    }),
  );

  expect(resolved.map(({ resource }) => resource.id)).toEqual([child.id, parent.id, child.id]);
  expect(observed.reads).toEqual([`tickets/${child.id}`, `tickets/${parent.id}`]);
});

test("batch resolution reads a missing ancestor once across different branch depths", async () => {
  const storage = createMemoryStorage();
  for (const [id, parentId] of [
    ["a", "missing"],
    ["b", "c"],
    ["c", "missing"],
  ]) {
    await ticketsCollection(storage).put(id, {
      id,
      shorthand: `T-${id}`,
      title: id,
      content: "Body stays available when opened",
      statusId: null,
      archived: id === "a",
      sortOrder: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      parentId,
    });
  }
  const observed = observeStorageReads(storage);
  const resources = ["a", "b", "a", "missing"].map((id) => ({ type: "ticket", id }));
  const resolved = await resolveTicketResourcesCommand.run(
    ...makeCommandArgs({
      storage: observed.storage,
      params: { resources },
      overrides: { resources: ticketContext(storage).resources },
    }),
  );

  expect(resolved.map(({ resource }) => resource.id)).toEqual(["a", "b", "a"]);
  expect(resolved[0].resource.metadata?.archived).toBe(true);
  expect(observed.reads).toEqual(["tickets/a", "tickets/b", "tickets/missing", "tickets/c"]);
});
