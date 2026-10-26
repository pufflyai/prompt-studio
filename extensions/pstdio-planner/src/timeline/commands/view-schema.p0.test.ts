import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../../commands/command-context.fixture";
import { createTicketCommand } from "../../commands/create-ticket";
import { migratePlannerStorage } from "../../data/migrate-storage";
import { createDeadlineCommand } from "./deadline-commands";
import { readPlanCommand } from "./read-plan";
import { timelineViewSchema } from "./view-schema";

test("an empty Timeline exposes its fields before a milestone is stored", async () => {
  const [ctx] = makeCommandArgs({ storage: createMemoryStorage(), params: {} });
  const schema = await timelineViewSchema(ctx);
  expect(schema.attributes).toEqual((await readPlanCommand.run(ctx, {})).ticketAttributes);
  expect(schema.attributes.map(({ id }) => id)).toContain("milestone");
});

test("saved-view fields match Timeline without querying ticket rows", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  await createTicketCommand.run(ctx, { content: "# Planned work" });
  await createDeadlineCommand.run(ctx, { date: "2030-01-01", name: "Release" });
  const plan = await readPlanCommand.run(ctx, {});
  await migratePlannerStorage(ctx);
  let ticketReads = 0;
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => {
    const items = collection<T>(name);
    return {
      ...items,
      list: async () => {
        if (name === "tickets") ticketReads++;
        return items.list();
      },
    };
  };
  const schema = await timelineViewSchema(ctx);
  expect(schema.attributes).toEqual(plan.ticketAttributes);
  expect(schema.rows).toEqual([]);
  expect(ticketReads).toBe(0);
});
