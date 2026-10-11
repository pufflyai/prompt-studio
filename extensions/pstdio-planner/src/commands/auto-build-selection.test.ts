import { expect, test } from "bun:test";
import { assignTrackCommand, createTrackCommand } from "../timeline/commands/track-commands";
import { autoBuildCommand } from "./auto-build";
import { fixture } from "./auto-build.fixture";
import { configureAutoBuildCommand } from "./auto-build-mode";

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
