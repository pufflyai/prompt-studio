import { expect, test } from "bun:test";
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "./command-context.fixture";
import { plannerCommands } from "./index";
import { openTicketsCommand } from "./open-tickets";

test("opens the tickets board through the registered Planner command", async () => {
  const targets: NavigationTarget[] = [];
  expect(plannerCommands).toContain(openTicketsCommand);
  await openTicketsCommand.run(
    ...makeCommandArgs({
      storage: createMemoryStorage(),
      params: {},
      overrides: {
        navigation: {
          open: (target) => {
            targets.push(target);
          },
        },
      },
    }),
  );
  expect(targets).toEqual([
    { kind: "page", page: { kind: "page", id: "tickets", extensionId: "pstdio.pstdio-planner" } },
  ]);
});
