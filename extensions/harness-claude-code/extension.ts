import { defineExtension } from "@pstdio/sdk/extensions";
import { createClaudeCodeHarness } from "./src/harness";

export default defineExtension({
  harnesses: {
    claudeCode: createClaudeCodeHarness(),
  },
});
