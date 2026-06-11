import { defineExtension } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./src/harness";

export default defineExtension({
  harnesses: {
    opencode: createOpencodeHarness(),
  },
});
