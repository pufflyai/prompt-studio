import { defineExtension } from "@pstdio/sdk/extensions";
import { createCodexHarness } from "./src/harness";

export default defineExtension({
  harnesses: {
    codex: createCodexHarness(),
  },
});
