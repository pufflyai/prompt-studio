import { defineExtension } from "@pstdio/sdk/extensions";
import { createCodexHarness } from "./src/harness";
import { provisionSkills } from "./src/hooks";

export default defineExtension({
  harnesses: {
    codex: createCodexHarness(),
  },
  hooks: {
    provisionSkills,
  },
});
