import { describe, expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { ticketMarkdownPath } from "../data/draft-storage";
import type { StoredTicket } from "../data/types";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { saveTicketCommand } from "./save-ticket";
import { updateTicketCommand } from "./update-ticket";

const setup = (mode: "update" | "save") => {
  const storage = createMemoryStorage();
  const repoFiles = createMemoryRepoFiles();
  const create = (title: string, dependsOn: string[] = []) =>
    createTicketCommand.run(...makeCommandArgs({ storage, params: { title, dependsOn } }));
  const setDependencies = async (ticket: StoredTicket, dependsOn: string[]) => {
    if (mode === "update") {
      await updateTicketCommand.run(
        ...makeCommandArgs({ storage, params: { id: ticket.shorthand, dependsOn, content: "# Edited" } }),
      );
      return;
    }
    await repoFiles.writeText(
      ticketMarkdownPath(ticket.shorthand),
      ["---", `depends_on: ${JSON.stringify(dependsOn)}`, "---", "# Edited"].join("\n"),
    );
    await saveTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: ticket.shorthand }, overrides: { repoFiles } }),
    );
  };
  return { storage, create, setDependencies };
};

describe.each(["update", "save"] as const)("%s ticket dependency validation", (mode) => {
  test.each(["shorthand", "id"] as const)("rejects self-dependencies by %s before saving", async (reference) => {
    const { storage, create, setDependencies } = setup(mode);
    const prerequisite = await create("Prerequisite");
    const ticket = await create("Ticket", [prerequisite.shorthand]);
    const before = await ticketsCollection(storage).list();

    await expect(setDependencies(ticket, [ticket[reference]])).rejects.toThrow(/dependency cycle/i);

    expect(await ticketsCollection(storage).list()).toEqual(before);
  });

  test.each([2, 3])("rejects a cycle across %i sequential ticket updates", async (length) => {
    const { storage, create, setDependencies } = setup(mode);
    const tickets = [];
    for (let index = 0; index < length; index++) tickets.push(await create(`Ticket ${index}`));
    for (let index = 0; index < length - 1; index++) {
      await setDependencies(tickets[index], [tickets[index + 1].shorthand]);
    }
    const before = await ticketsCollection(storage).list();

    await expect(setDependencies(tickets[length - 1], [tickets[0].shorthand])).rejects.toThrow(/dependency cycle/i);

    expect(await ticketsCollection(storage).list()).toEqual(before);
  });

  test("accepts dependencies with a shared prerequisite", async () => {
    const { storage, create, setDependencies } = setup(mode);
    const prerequisite = await create("Prerequisite");
    const first = await create("First", [prerequisite.shorthand]);
    const second = await create("Second", [prerequisite.shorthand]);
    const ticket = await create("Ticket");

    await setDependencies(ticket, [first.shorthand, second.shorthand]);

    expect(await ticketsCollection(storage).get(ticket.id)).toMatchObject({ dependsOn: [first.id, second.id] });
  });

  test("can clear a stored cycle", async () => {
    const { storage, create, setDependencies } = setup(mode);
    const ticket = await create("Ticket");
    await ticketsCollection(storage).put(ticket.id, { ...ticket, dependsOn: [ticket.id] });

    await setDependencies(ticket, []);

    expect(await ticketsCollection(storage).get(ticket.id)).toMatchObject({ dependsOn: [] });
  });
});
