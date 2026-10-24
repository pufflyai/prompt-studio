import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { ticketFilesDir, ticketMarkdownPath } from "../data/draft-storage";
import { plannerTicketsChanged } from "../events";
import { makeCommandArgs } from "./command-context.fixture";
import { saveTicketCommand } from "./save-ticket";
import { writeTicketCommand } from "./write-ticket";

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
              files: [expect.objectContaining({ name: "notes.md", content: "Updated notes" })],
            });
            events.push({ event, payload });
            return { delivered: 0 };
          },
        },
      },
    }),
  );

  expect(events).toEqual([{ event: plannerTicketsChanged, payload: { ticketId: ticket.id } }]);
});
