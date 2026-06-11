import { defineExtension } from "@pstdio/sdk/extensions";
import { createFakeHarness } from "./src/harness";

export default defineExtension({
  harnesses: {
    fake: createFakeHarness(),
  },
});
