import { expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { assignTrackCommand, createTrackCommand } from "../timeline/commands/track-commands";
import { autoBuildCommand } from "./auto-build";
import { fixture } from "./auto-build.fixture";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";
import { automationPolicyCommand } from "./automation-policy";

test("current view filters select matching tickets across tracks", async () => {
  const { ctx, ticket } = await fixture();
  const first = await ticket("Ship the API");
  const second = await ticket("Ship the UI");
  await ticket("Unrelated work");
  const track = await createTrackCommand.run(ctx, { name: "UI" });
  await assignTrackCommand.run(ctx, { ticket: second.id, track: track.id });
  await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Ship" }] },
  });
  expect((await autoBuildCommand.run(ctx, {})).started.map(({ ticket }) => ticket)).toEqual([
    first.shorthand,
    second.shorthand,
  ]);
});

test("starting Auto Build updates the shared parallel task limit before assigning work", async () => {
  const { ctx, ticket } = await fixture(2);
  for (let index = 0; index < 4; index += 1) await ticket(`Task ${index}`);
  await configureAutoBuildCommand.run(ctx, { enabled: true, maxInProgress: 3 });
  expect(await automationPolicyCommand.run(ctx, {})).toEqual({ maxInProgress: 3 });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ maxInProgress: 3 });
  expect((await autoBuildCommand.run(ctx, {})).started).toHaveLength(3);
});

test("a zero parallel task limit prevents automatic assignments", async () => {
  const { ctx, ticket } = await fixture();
  await ticket("Wait for capacity");
  await configureAutoBuildCommand.run(ctx, { enabled: true, maxInProgress: 0 });
  expect(await automationPolicyCommand.run(ctx, {})).toEqual({ maxInProgress: 0 });
  expect((await autoBuildCommand.run(ctx, {})).started).toHaveLength(0);
});

test("invalid parallel task limits leave the project setting unchanged", async () => {
  const { ctx } = await fixture();
  for (const maxInProgress of [-1, 1.5]) {
    await expect(configureAutoBuildCommand.run(ctx, { enabled: true, maxInProgress })).rejects.toThrow(
      "non-negative integer",
    );
  }
  expect(await automationPolicyCommand.run(ctx, {})).toEqual({ maxInProgress: 2 });
});

test("a new ticket moved to In Progress during readiness does not get a new attempt", async () => {
  const { ctx, ticket } = await fixture();
  const task = await ticket("Already assigned elsewhere");
  const run = ctx.process.run;
  ctx.process.run = async (input) => {
    const stored = await ticketsCollection(ctx.storage).get(task.id);
    await ticketsCollection(ctx.storage).put(task.id, { ...stored!, statusId: "in-progress" });
    return run(input);
  };
  expect((await autoBuildCommand.run(ctx, {})).started).toHaveLength(0);
});
