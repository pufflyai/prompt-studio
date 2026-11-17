import { defineExtension, defineHarness } from "@pstdio/sdk/extensions";
import { createCodexHarness } from "./src/harness";
import { provisionSkills } from "./src/hooks";
import { quotasCommand } from "./src/quotas";
export default defineExtension({
  commands: [quotasCommand],
  harnesses: [defineHarness(createCodexHarness())],
  hooks: [provisionSkills],
});
