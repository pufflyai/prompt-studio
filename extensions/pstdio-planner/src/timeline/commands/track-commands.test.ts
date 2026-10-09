import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../../commands/command-context.fixture";
import { plannerTicketsChanged } from "../../events";
import { createTrackCommand, renameTrackCommand } from "./track-commands";

test("creating and renaming tracks notify Planner views", async () => {
  const events: unknown[] = [];
  const [ctx] = makeCommandArgs({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      events: {
        emit: async (event) => {
          events.push(event);
          return { delivered: 1 };
        },
      },
    },
  });
  const track = await createTrackCommand.run(ctx, { name: "Product" });
  expect(events).toEqual([plannerTicketsChanged]);
  await renameTrackCommand.run(ctx, { track: track.id, name: "Platform" });
  expect(events).toEqual([plannerTicketsChanged, plannerTicketsChanged]);
});
