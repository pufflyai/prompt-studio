import { expect, test } from "bun:test";
import { parsePageUrl } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { ticketDocumentPage } from "../data/ticket-page-target";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { documentLinkCommand } from "./document-link";
import { createTicketFileCommand, updateTicketFileCommand } from "./ticket-files";

test("saved document links resolve shorthand and file names to stable IDs", async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Links" } }));
  const file = await createTicketFileCommand.run(
    ...makeCommandArgs({ storage, params: { ticketId: ticket.id, name: "research.md" } }),
  );
  const link = await documentLinkCommand.run(
    ...makeCommandArgs({
      storage,
      params: { id: ticket.shorthand, file: file.name },
    }),
  );
  const location = parsePageUrl({ url: link.href, projectId: "proj-1", pages: [ticketDocumentPage] });
  expect(location?.resource).toMatchObject({ type: "ticket", id: ticket.id, metadata: { documentId: file.id } });
  await updateTicketFileCommand.run(
    ...makeCommandArgs({
      storage,
      params: { ticketId: ticket.id, fileId: file.id, name: "renamed.md" },
    }),
  );
  expect(
    await documentLinkCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.id, file: file.id },
      }),
    ),
  ).toEqual(link);
  expect(link.href).not.toContain("research.md");
});

test("menu links use the bound document and unselected ticket links open the body", async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Links" } }));
  const file = await createTicketFileCommand.run(
    ...makeCommandArgs({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
  );
  const selected = await documentLinkCommand.run(
    ...makeCommandArgs({
      storage,
      params: {},
      overrides: { resource: { type: "ticket", id: ticket.id, metadata: { documentId: file.id } } },
    }),
  );
  expect(selected.href).toContain(`document=${file.id}`);
  const body = await documentLinkCommand.run(...makeCommandArgs({ storage, params: { id: ticket.id } }));
  expect(body.href).not.toContain("document=");
});

test("a deleted or foreign saved document cannot produce a link", async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Links" } }));
  const other = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Other" } }));
  const file = await createTicketFileCommand.run(
    ...makeCommandArgs({ storage, params: { ticketId: other.id, name: "other.md" } }),
  );
  for (const selector of ["deleted", file.id]) {
    await expect(
      documentLinkCommand.run(
        ...makeCommandArgs({
          storage,
          params: { id: ticket.id, file: selector },
        }),
      ),
    ).rejects.toThrow("Document unavailable");
  }
  await ticketsCollection(storage).delete(ticket.id);
  await expect(
    documentLinkCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.id },
      }),
    ),
  ).rejects.toThrow("Ticket unavailable");
});

test("duplicate file names require a document ID instead of choosing another file", async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Links" } }));
  const files = [];
  for (let index = 0; index < 2; index++) {
    files.push(
      await createTicketFileCommand.run(
        ...makeCommandArgs({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
      ),
    );
  }
  await expect(
    documentLinkCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.id, file: "notes.md" },
      }),
    ),
  ).rejects.toThrow("ambiguous");
  for (const file of files) {
    const link = await documentLinkCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.id, file: file.id },
      }),
    );
    expect(link.href).toContain(`document=${file.id}`);
  }
});
