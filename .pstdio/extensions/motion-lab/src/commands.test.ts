import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { commands } from "./commands";
import type { ReviewChange } from "./review-state";

test("concurrent preview and parameter updates preserve both changes", async () => {
  const storage = createMemoryStorage();
  await Promise.all([
    commands["review.update"].run(
      ...makeCommandArgs({
        storage,
        params: { study: "tabs", change: { loopRange: [60, 120] } satisfies ReviewChange },
      }),
    ),
    commands["review.update"].run(
      ...makeCommandArgs({
        storage,
        params: { study: "tabs", change: { settings: { theme: "dark" } } satisfies ReviewChange },
      }),
    ),
  ]);
  const saved = await commands["review.read"].run(...makeCommandArgs({ storage, params: { study: "tabs" } }));
  expect(saved).toMatchObject({ loopRange: [60, 120], settings: { theme: "dark" } });
});
