import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { listTicketsCommand } from "./list-tickets";

describe("listTicketsCommand", () => {
  test("returns display rows and filters by status and parent", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedDefaultTags(storage);
    const parent = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Parent" } }));
    const child = await createTicketCommand.run(
      makeCommandContext({
        storage,
        params: { title: "Child", status: "In Progress", tags: ["High"], parent: parent.shorthand },
      }),
    );

    const all = await listTicketsCommand.run(makeCommandContext({ storage, params: {} }));
    expect(all).toHaveLength(2);

    const childRow = all.find((row) => row.shorthand === child.shorthand)!;
    expect(childRow.status).toBe("In Progress");
    expect(childRow.tags).toEqual(["High"]);

    const children = await listTicketsCommand.run(
      makeCommandContext({ storage, params: { parent: parent.shorthand } }),
    );
    expect(children.map((row) => row.shorthand)).toEqual([child.shorthand]);

    const inProgress = await listTicketsCommand.run(makeCommandContext({ storage, params: { status: "In Progress" } }));
    expect(inProgress.map((row) => row.shorthand)).toEqual([child.shorthand]);
  });

  test("hides archived and draft tickets by default; flags select that subset", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const open = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Open" } }));
    const done = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Done" } }));
    const draft = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Draft" } }));
    await ticketsCollection(storage).put(done.id, { ...done, archived: true });
    await ticketsCollection(storage).put(draft.id, { ...draft, draft: true });

    const byDefault = await listTicketsCommand.run(makeCommandContext({ storage, params: {} }));
    expect(byDefault.map((row) => row.shorthand)).toEqual([open.shorthand]);

    const archived = await listTicketsCommand.run(makeCommandContext({ storage, params: { archived: true } }));
    expect(archived.map((row) => row.shorthand)).toEqual([done.shorthand]);

    const drafts = await listTicketsCommand.run(makeCommandContext({ storage, params: { draft: true } }));
    expect(drafts.map((row) => row.shorthand)).toEqual([draft.shorthand]);
  });
});
