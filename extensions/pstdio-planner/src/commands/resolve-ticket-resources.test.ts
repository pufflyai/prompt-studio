import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
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
  const resources = [{ type: "ticket", id: ticket.id, metadata: { documentId: file.id } }];
  const resolve = () => resolveTicketResourcesCommand.run(...makeCommandArgs({ storage, params: { resources } }));
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
