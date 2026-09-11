import { test } from "bun:test";
import { join } from "node:path";
import { runBunScenario } from "../../test-utils/run-bun-scenario";

test("replaces an installed extension after validating its imported dependencies", async () => {
  await runBunScenario(join(import.meta.dir, "install-extension-source-promotion.fixture.ts"));
});
