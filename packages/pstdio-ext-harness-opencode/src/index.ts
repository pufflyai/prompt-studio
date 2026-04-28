import { defineExtension } from "@pstdio/sdk/extensions";
import { createOpencodeHarnessProvider } from "./providers/opencode";

export const OPENCODE_HARNESS_EXTENSION_ID = "pstdio.harness.opencode";
export const OPENCODE_HARNESS_PACKAGE_NAME = "@pstdio/pstdio-ext-harness-opencode";
export { createOpencodeHarnessProvider };

export default defineExtension({
  id: OPENCODE_HARNESS_EXTENSION_ID,
  name: "OpenCode Harness",
  version: "0.1.0",
  harnesses: {
    opencode: createOpencodeHarnessProvider(),
  },
});
