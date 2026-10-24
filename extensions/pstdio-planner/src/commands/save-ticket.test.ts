import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { updateTicket } from "../data/collections";
import { ticketFilesDir, ticketMarkdownPath } from "../data/draft-storage";
import { updateTicketFile } from "../data/file-operations";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { ticketContext, ticketsCollection } from "../data/ticket-context.fixture";
import { readTicketFileContent } from "../data/ticket-file-content";
import { readTicketImageCheckout } from "../data/ticket-image-checkout";
import { plannerTicketsChanged } from "../events";
import { attachTicketFileCommand } from "./attach-ticket-file";
import { makeCommandArgs } from "./command-context.fixture";
import { saveTicketCommand } from "./save-ticket";
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
  return { storage, projectFiles, ticket, image, save, imageBytes };
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

test("overlapping saves with different images leave a checkout that names only stored images", async () => {
  const { storage, projectFiles, ticket, image, save, imageBytes } = await ticketWithChangedImage();
  // The first save's checkout write is slow. A second save of a newer image starts meanwhile.
  let second: unknown;
  const writeText = projectFiles.writeText.bind(projectFiles);
  projectFiles.writeText = async (path, text) => {
    if (path.endsWith("image-checkout.json") && !second) {
      await projectFiles.writeBytes(image, new Uint8Array([3]));
      second = save();
      await Bun.sleep(50);
    }
    return writeText(path, text);
  };

  await save();
  await second;

  const stored = (await ticketsCollection(storage).get(ticket.id))!;
  const checkout = await readTicketImageCheckout(projectFiles, ticket.shorthand);
  const ids = stored.attachments!.map((attachment) => attachment.id);
  expect(Object.values(checkout).every((id) => ids.includes(id))).toBe(true);
  expect(await imageBytes()).toEqual([[3]]);
});

test("saving local ticket edits notifies views after storing the body and files", async () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  const { shorthand } = await writeTicketCommand.run(
    ...makeCommandArgs({ storage, params: { title: "Original" }, overrides: { projectFiles } }),
  );
  const [ticket] = await ticketsCollection(storage).list();
  const content = "# Updated ticket\n\nSaved from the local checkout.";
  await projectFiles.writeText(ticketMarkdownPath(shorthand), content);
  await projectFiles.writeText(`${ticketFilesDir(shorthand)}/notes.md`, "Updated notes");
  const events: unknown[] = [];

  await saveTicketCommand.run(
    ...makeCommandArgs({
      storage,
      params: { id: shorthand },
      overrides: {
        projectFiles,
        events: {
          emit: async (event, payload) => {
            expect(await ticketsCollection(storage).get(ticket.id)).toMatchObject({
              title: "Updated ticket",
              content,
              draft: false,
              files: [expect.objectContaining({ name: "notes.md" })],
            });
            const [file] = (await ticketsCollection(storage).get(ticket.id))!.files!;
            expect(await readTicketFileContent(storage, ticket.id, file!)).toBe("Updated notes");
            events.push({ event, payload });
            return { delivered: 0 };
          },
        },
      },
    }),
  );

  expect(events).toEqual([{ event: plannerTicketsChanged, payload: { ticketId: ticket.id } }]);
});
