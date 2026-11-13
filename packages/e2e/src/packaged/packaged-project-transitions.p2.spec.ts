import { test } from "../scripts/playwright-test";
import { buildBinary } from "./packaged-helpers";
import { qualifyProjectTransitions } from "./packaged-project-transitions.fixture";

test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

for (const count of [2, 10])
  test(`${count} production projects return to five warm views without a full read or inactive work`, async ({
    playwright,
  }, testInfo) => {
    await qualifyProjectTransitions(playwright, count, testInfo);
  });
