import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../../commands/command-context.fixture";
import { createTicketCommand } from "../../commands/create-ticket";
import { moveTicketInPlan } from "./move-ticket";
import { writeStoredPlan } from "./plan-store";

test("moving a ticket by an old number keeps its own deadline", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const first = await createTicketCommand.run(ctx, { title: "First" });
  const second = await createTicketCommand.run(ctx, { title: "Second" });
  await writeStoredPlan(storage, {
    deadlines: [
      { id: "first-date", date: "2026-11-01" },
      { id: "second-date", date: "2026-11-02" },
    ],
    order: [
      { ticketId: first.id, deadlineId: "first-date" },
      { ticketId: second.id, deadlineId: "second-date" },
    ],
  });
  const identity = { id: second.id, kind: "ticket", shorthand: "T-3", aliases: ["T-2"] };
  const core = ctx.resources.identity;
  ctx.resources.identity = (input) => (input.id === second.id ? Promise.resolve(identity) : core(input));
  ctx.resources.findByShorthand = async () => [identity];
  expect(await moveTicketInPlan(ctx, { ticket: "T-2" })).toEqual({ ticketId: second.id, deadlineId: "second-date" });
});

test("moving a ticket before an archived ticket is rejected", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const moved = await createTicketCommand.run(ctx, { title: "Moved" });
  const archived = await createTicketCommand.run(ctx, { title: "Archived" });
  const records = storage.collection<Record<string, unknown>>("tickets");
  await records.put(archived.id, { ...(await records.get(archived.id)), archived: true });
  await expect(moveTicketInPlan(ctx, { ticket: moved.id, before: archived.id })).rejects.toThrow(
    `Unknown ticket "${archived.id}".`,
  );
});
