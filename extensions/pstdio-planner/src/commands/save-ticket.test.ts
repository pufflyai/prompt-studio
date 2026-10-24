import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketFilesDir } from "../data/draft-storage";
import { updateTicketFile } from "../data/file-operations";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { ticketContext, ticketsCollection } from "../data/ticket-context.fixture";
import { readTicketFileContent } from "../data/ticket-file-content";
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
