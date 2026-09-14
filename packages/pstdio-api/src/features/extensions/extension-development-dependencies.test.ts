import { test } from "bun:test";
import { join } from "node:path";
import { runBunScenario } from "../../test-utils/run-bun-scenario";

test("dev installs local provider dependencies in their source context and reloads consumer edits", async () => {
  await runBunScenario(join(import.meta.dir, "extension-development-dependencies.fixture.ts"));
});
