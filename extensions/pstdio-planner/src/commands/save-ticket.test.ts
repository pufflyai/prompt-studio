import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { updateTicket } from "../data/collections";
import { ticketFilesDir, ticketMarkdownPath } from "../data/draft-storage";
import { updateTicketFile } from "../data/file-operations";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { ticketContext, ticketsCollection } from "../data/ticket-context.fixture";
import { readTicketFileContent } from "../data/ticket-file-content";
import { attachTicketFileCommand } from "./attach-ticket-file";
import { makeCommandArgs } from "./command-context.fixture";
import { saveTicketCommand } from "./save-ticket";
import { updateTicketCommand } from "./update-ticket";
import { writeTicketCommand } from "./write-ticket";

const setup = async () => {
  const storage = createMemoryStorage();
  await seedDefaultStatuses(storage);
  await seedDefaultTags(storage);
  return { storage, projectFiles: createMemoryRepoFiles() };
};

test("save racing a file edit from the editor leaves every file readable", async () => {
  const { storage, projectFiles } = await setup();
  const { shorthand } = await writeTicketCommand.run(
    ...makeCommandArgs({ storage, params: { title: "Original" }, overrides: { projectFiles } }),
  );
  const notes = `${ticketFilesDir(shorthand)}/notes.md`;
  await projectFiles.writeText(notes, "local notes");
  const save = () =>
    saveTicketCommand.run(...makeCommandArgs({ storage, params: { id: shorthand }, overrides: { projectFiles } }));
  await save();
  const [ticket] = await ticketsCollection(storage).list();

  // The editor saves the file after `pst tickets save` has read the ticket. The save must not
  // compare against or keep the body the editor replaced.
  let edit: Promise<unknown> | undefined;
  const readText = projectFiles.readText.bind(projectFiles);
  projectFiles.readText = async (path) => {
    if (path === notes && !edit) {
      edit = updateTicketFile({
        ...ticketContext(storage),
        ticketId: ticket.id,
        fileId: ticket.files![0].id,
        content: "editor notes",
      });
      await Promise.race([edit, Bun.sleep(50)]);
    }
    return readText(path);
  };
  await save();
  await edit;

  const saved = (await ticketsCollection(storage).get(ticket.id))!;
  expect(saved.files).toHaveLength(1);
  expect(await readTicketFileContent(storage, ticket.id, saved.files![0])).toBe("editor notes");
});

// A ticket with a saved local image, whose local copy has since changed.
const ticketWithChangedImage = async () => {
  const { storage, projectFiles } = await setup();
  const { shorthand } = await writeTicketCommand.run(
    ...makeCommandArgs({ storage, params: { title: "Original" }, overrides: { projectFiles } }),
  );
  const image = `${ticketFilesDir(shorthand)}/diagram.png`;
  await projectFiles.writeBytes(image, new Uint8Array([1]));
  const save = () =>
    saveTicketCommand.run(...makeCommandArgs({ storage, params: { id: shorthand }, overrides: { projectFiles } }));
  await save();
  await projectFiles.writeBytes(image, new Uint8Array([2]));
  const [ticket] = await ticketsCollection(storage).list();
  const imageBytes = async () => {
    const stored = (await ticketsCollection(storage).get(ticket.id))!;
    const blobs = storage.scope({ type: "resource", resource: { type: "ticket", id: ticket.id } }).files;
    const saved = stored.attachments!.filter((attachment) => attachment.name === "diagram.png");
    // The replaced image is deleted, so the ticket keeps only the blob it uses.
    expect(await blobs.list()).toHaveLength(1);
    return Promise.all(saved.map(async (attachment) => [...(await blobs.getBytes(attachment.id))]));
  };
  return { storage, ticket, save, imageBytes };
};

const otherAttachment = {
  id: "upload-1",
  name: "upload.png",
  mimeType: "image/png",
  size: 1,
  hash: "hash",
  url: "/upload-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test.each([
  ["save first", true],
  ["attach first", false],
])("save racing an attach keeps both images and every image readable (%s)", async (_order, saveFirst) => {
  const { storage, ticket, save, imageBytes } = await ticketWithChangedImage();
  const attach = () =>
    attachTicketFileCommand.run(...makeCommandArgs({ storage, params: { ticketId: ticket.id, ref: otherAttachment } }));

  await Promise.all(saveFirst ? [save(), attach()] : [attach(), save()]);

  const stored = (await ticketsCollection(storage).get(ticket.id))!;
  expect(stored.attachments?.map((attachment) => attachment.id)).toContain(otherAttachment.id);
  expect(await imageBytes()).toEqual([[2]]);
});

test("a ticket write that read the ticket before a save keeps the saved image", async () => {
  const { storage, ticket, save, imageBytes } = await ticketWithChangedImage();

  await save();
  await updateTicket(ticketContext(storage), { ...ticket, title: "Renamed" });

  expect((await ticketsCollection(storage).get(ticket.id))?.title).toBe("Renamed");
  expect(await imageBytes()).toEqual([[2]]);
});

test("save keeps a tag change made by another command while the save runs", async () => {
  const { storage, projectFiles } = await setup();
  const { shorthand } = await writeTicketCommand.run(
    ...makeCommandArgs({ storage, params: { title: "Tagged", tags: ["High"] }, overrides: { projectFiles } }),
  );
  const markdown = ticketMarkdownPath(shorthand);
  const readText = projectFiles.readText.bind(projectFiles);
  let edited = false;
  projectFiles.readText = async (path) => {
    if (path === markdown && !edited) {
      edited = true;
      await updateTicketCommand.run(...makeCommandArgs({ storage, params: { id: shorthand, tags: ["High", "Bug"] } }));
    }
    return readText(path);
  };

  await saveTicketCommand.run(...makeCommandArgs({ storage, params: { id: shorthand }, overrides: { projectFiles } }));

  const [ticket] = await ticketsCollection(storage).list();
  expect(ticket.tags).toEqual({ "default-priority": "default-priority-high", "default-type": "default-type-bug" });
});
