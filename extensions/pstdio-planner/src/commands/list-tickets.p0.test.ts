import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { ticketsCollection } from "../data/ticket-context.fixture";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { listTicketsCommand } from "./list-tickets";

describe("listTicketsCommand", () => {
  test("rebuilds a summary when sync changes a ticket during display-name enrichment", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Local" } }));
    const query = storage.records.query.bind(storage.records);
    let changed = false;
    let projected = false;
    storage.records.query = async (input) => {
      const page = await query(input);
      if (input.index === "ticket-view" && input.revision && input.fields?.includes("shorthand")) projected = true;
      if (input.index === "definitions:ticket-statuses" && projected && !changed) {
        changed = true;
        await ticketsCollection(storage).put(ticket.id, { ...ticket, title: "Synced", content: "# Synced" });
      }
      return page;
    };

    const result = await listTicketsCommand.run(...makeCommandArgs({ storage, params: {} }));

    expect(result.tickets.map(({ title }) => title)).toEqual(["Synced"]);
  });

  test("propagates unrelated storage failures without restarting the read", async () => {
    const storage = createMemoryStorage();
    await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Local" } }));
    const query = storage.records.query.bind(storage.records);
    let pageQueries = 0;
    storage.records.query = async (input) => {
      if (input.index === "ticket-view" && input.revision) {
        pageQueries++;
        throw new Error("Storage unavailable");
      }
      return query(input);
    };

    await expect(listTicketsCommand.run(...makeCommandArgs({ storage, params: {} }))).rejects.toThrow(
      "Storage unavailable",
    );
    expect(pageQueries).toBe(1);
  });

  test("restarts a first-page summary across successive sync revisions", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Local" } }));
    const query = storage.records.query.bind(storage.records);
    let revisionChecks = 0;
    storage.records.query = async (input) => {
      if (input.index === "ticket-view" && input.revision && input.fields?.includes("shorthand")) {
        revisionChecks++;
        if (revisionChecks <= 2)
          await ticketsCollection(storage).put(ticket.id, {
            ...ticket,
            title: `Synced ${revisionChecks}`,
            content: `# Synced ${revisionChecks}`,
          });
      }
      return query(input);
    };

    const result = await listTicketsCommand.run(...makeCommandArgs({ storage, params: {} }));

    expect(revisionChecks).toBe(3);
    expect(result.total).toBe(1);
    expect(result.tickets.map(({ title }) => title)).toEqual(["Synced 2"]);
  });

  test("returns display rows and filters by status and parent", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedDefaultTags(storage);
    const parent = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Parent" } }));
    const child = await createTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: { title: "Child", status: "In Progress", tags: ["High"], parent: parent.shorthand },
      }),
    );

    const all = await listTicketsCommand.run(...makeCommandArgs({ storage, params: {} }));
    expect(all.tickets).toHaveLength(2);

    const childRow = all.tickets.find((row) => row.shorthand === child.shorthand)!;
    expect(childRow.status).toBe("In Progress");
    expect(childRow.tags).toEqual(["High"]);

    const children = await listTicketsCommand.run(
      ...makeCommandArgs({ storage, params: { parent: parent.shorthand } }),
    );
    expect(children.tickets.map((row) => row.shorthand)).toEqual([child.shorthand]);

    const inProgress = await listTicketsCommand.run(...makeCommandArgs({ storage, params: { status: "In Progress" } }));
    expect(inProgress.tickets.map((row) => row.shorthand)).toEqual([child.shorthand]);
  });

  test("hides archived and draft tickets by default; flags select that subset", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const open = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Open" } }));
    const done = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Done" } }));
    const draft = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Draft" } }));
    await ticketsCollection(storage).put(done.id, { ...done, archived: true });
    await ticketsCollection(storage).put(draft.id, { ...draft, draft: true });

    const byDefault = await listTicketsCommand.run(...makeCommandArgs({ storage, params: {} }));
    expect(byDefault.tickets.map((row) => row.shorthand)).toEqual([open.shorthand]);

    const archived = await listTicketsCommand.run(...makeCommandArgs({ storage, params: { archived: true } }));
    expect(archived.tickets.map((row) => row.shorthand)).toEqual([done.shorthand]);

    const drafts = await listTicketsCommand.run(...makeCommandArgs({ storage, params: { draft: true } }));
    expect(drafts.tickets.map((row) => row.shorthand)).toEqual([draft.shorthand]);
  });
});
