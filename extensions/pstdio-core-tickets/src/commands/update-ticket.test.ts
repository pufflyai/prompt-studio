import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { getTicketCommand } from "./get-ticket";
import { updateTicketCommand } from "./update-ticket";

describe("get/update ticket commands", () => {
  test("getTicket returns the stored ticket or null", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "X" } }));

    const found = await getTicketCommand.run(makeCommandContext({ storage, params: { id: created.id } }));
    const missing = await getTicketCommand.run(makeCommandContext({ storage, params: { id: "nope" } }));

    expect(found?.id).toBe(created.id);
    expect(missing).toBeNull();
  });

  test("updateTicket patches content without clobbering the title", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Keep me", content: "old" } }),
    );

    const updated = await updateTicketCommand.run(
      makeCommandContext({ storage, params: { id: created.id, content: "new body" } }),
    );

    expect(updated?.content).toBe("new body");
    expect(updated?.title).toBe("Keep me");

    const persisted = await ticketsCollection(storage).get(created.id);
    expect(persisted?.content).toBe("new body");
  });

  test("updateTicket returns null for an unknown ticket", async () => {
    const storage = createMemoryStorage();
    const result = await updateTicketCommand.run(
      makeCommandContext({ storage, params: { id: "missing", content: "x" } }),
    );
    expect(result).toBeNull();
  });
});
