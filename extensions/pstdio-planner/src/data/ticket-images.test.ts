import { describe, expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../commands/command-context.fixture";
import { pullTicketCommand } from "../commands/pull-ticket";
import { saveTicketCommand } from "../commands/save-ticket";
import { writeTicketCommand } from "../commands/write-ticket";
import { ticketsCollection } from "./collections";
import { ticketFilesDir } from "./draft-storage";
import { seedDefaultStatuses, seedDefaultTags } from "./seed";
import { writeTicketImageCheckout } from "./ticket-image-checkout";
import { pullTicketImages, saveTicketImages } from "./ticket-images";

// The PNG signature contains bytes that are not valid UTF-8, so a text round trip would change them.
const screenshot = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00, 0xfe]);

const setup = async () => {
  const storage = createMemoryStorage();
  await seedDefaultStatuses(storage);
  await seedDefaultTags(storage);
  const projectFiles = createMemoryRepoFiles();
  const args = <TParams extends Record<string, unknown>>(params: TParams) =>
    makeCommandArgs({ storage, params, overrides: { projectFiles } });
  const { shorthand } = await writeTicketCommand.run(...args({ title: "Export fails" }));
  const save = () => saveTicketCommand.run(...args({ id: shorthand }));
  const pull = () => pullTicketCommand.run(...args({ id: shorthand }));
  const readTicket = async () => (await ticketsCollection(storage).list())[0];
  // Dashboard uploads and saved images share the ticket's storage scope.
  const files = storage.scope({ type: "resource", resource: { type: "ticket", id: (await readTicket()).id } }).files;
  const upload = async (name: string, data: Uint8Array) => ({
    ...(await files.put({ name, data, mimeType: "image/png" })),
    hash: new Bun.CryptoHasher("sha256").update(data).digest("hex"),
  });
  return {
    storage,
    files,
    projectFiles,
    path: `${ticketFilesDir(shorthand)}/error.png`,
    save,
    pull,
    readTicket,
    upload,
  };
};

describe("ticket images", () => {
  test("pull and save preserve separate attachments with the same name", async () => {
    const { storage, files, projectFiles, readTicket, upload } = await setup();
    const ticket = await readTicket();
    const attachments = [];
    for (const byte of [1, 2, 3]) {
      attachments.push(await upload(byte === 3 ? "proof (2).png" : "proof.png", new Uint8Array([byte])));
    }
    const stored = { ...ticket, attachments };
    await pullTicketImages(storage, projectFiles, stored);
    const paths = [...projectFiles.files.keys()].filter((path) => path.endsWith(".png"));
    expect(paths).toHaveLength(3);
    const result = await saveTicketImages(storage, projectFiles, stored, paths);
    expect(result.replacedIds).toEqual([]);
    expect(await Promise.all(result.attachments.map(({ id }) => files.getBytes(id)))).toEqual([
      new Uint8Array([1]),
      new Uint8Array([2]),
      new Uint8Array([3]),
    ]);
    const secondPath = paths.find((path) => path.endsWith("proof (3).png"))!;
    await projectFiles.writeBytes(secondPath, new Uint8Array([4]));
    const changed = await saveTicketImages(storage, projectFiles, stored, paths);
    expect(changed.replacedIds).toEqual([attachments[1].id]);
    expect(await Promise.all(changed.attachments.map(({ id }) => files.getBytes(id)))).toEqual([
      new Uint8Array([1]),
      new Uint8Array([4]),
      new Uint8Array([3]),
    ]);
    await writeTicketImageCheckout(projectFiles, ticket.shorthand, changed.checkout);
    expect(
      (await saveTicketImages(storage, projectFiles, { ...stored, attachments: changed.attachments }, paths))
        .replacedIds,
    ).toEqual([]);
  });

  test("a PNG upload without a suffix gets an image checkout name and keeps its original attachment name", async () => {
    const { storage, projectFiles, readTicket, upload } = await setup();
    const attachment = await upload("Screenshot", screenshot);
    const ticket = { ...(await readTicket()), attachments: [attachment] };
    await pullTicketImages(storage, projectFiles, ticket);
    const path = `${ticketFilesDir(ticket.shorthand)}/Screenshot.png`;
    expect(await projectFiles.readBytes(path)).toEqual(screenshot);
    const result = await saveTicketImages(storage, projectFiles, ticket, [path]);
    expect(result.attachments).toEqual([attachment]);
    expect(result.replacedIds).toEqual([]);
  });

  test("saving a checkout cannot overwrite a later dashboard upload with a colliding name", async () => {
    const { storage, files, projectFiles, readTicket, pull, save, upload } = await setup();
    const ticket = await readTicket();
    const first = await upload("proof.png", new Uint8Array([1]));
    const second = await upload("proof.png", new Uint8Array([2]));
    await ticketsCollection(storage).put(ticket.id, { ...ticket, attachments: [first, second] });
    projectFiles.files.clear();
    await pull();
    const later = await upload("proof (2).png", new Uint8Array([3]));
    await ticketsCollection(storage).put(ticket.id, { ...ticket, attachments: [first, second, later] });
    await save();
    const saved = await readTicket();
    expect(saved.attachments?.map(({ id }) => id)).toEqual([first.id, second.id, later.id]);
    expect(await files.getBytes(later.id)).toEqual(new Uint8Array([3]));
  });
  test("save stores an image from the files folder as an attachment with its exact bytes", async () => {
    const { files, projectFiles, path, save, readTicket } = await setup();
    await projectFiles.writeBytes(path, screenshot);
    await projectFiles.writeText(path.replace("error.png", "notes.md"), "notes");

    await save();

    const ticket = await readTicket();
    expect(ticket.files?.map(({ name }) => name)).toEqual(["notes.md"]);
    expect(ticket.attachments).toHaveLength(1);
    expect(ticket.attachments?.[0]).toMatchObject({ name: "error.png", mimeType: "image/png" });
    expect(await files.getBytes(ticket.attachments![0].id)).toEqual(screenshot);
  });

  test("save keeps an unchanged image and replaces a changed one", async () => {
    const { projectFiles, path, save, readTicket } = await setup();
    await projectFiles.writeBytes(path, screenshot);
    await save();
    const first = (await readTicket()).attachments![0];

    await save();
    expect((await readTicket()).attachments).toEqual([first]);

    await projectFiles.writeBytes(path, new Uint8Array([...screenshot, 0x01]));
    await save();
    const replaced = (await readTicket()).attachments!;
    expect(replaced).toHaveLength(1);
    expect(replaced[0].id).not.toBe(first.id);
  });

  test("pull writes image attachments back to the files folder", async () => {
    const { projectFiles, path, save, pull } = await setup();
    await projectFiles.writeBytes(path, screenshot);
    await save();

    projectFiles.files.clear();
    await pull();

    expect(await projectFiles.readBytes(path)).toEqual(screenshot);
  });
});
