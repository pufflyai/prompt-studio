import { defineExtension } from "@pstdio/sdk/extensions";
import { createFakeHarnessProvider } from "./providers/fake";

export const FAKE_HARNESS_EXTENSION_ID = "pstdio.harness.fake";
export const FAKE_HARNESS_PACKAGE_NAME = "@pstdio/pstdio-ext-harness-fake";
export { createFakeHarnessProvider };

export default defineExtension({
  id: FAKE_HARNESS_EXTENSION_ID,
  name: "Fake Harness",
  version: "0.1.0",
  harnesses: {
    fake: createFakeHarnessProvider(),
  },
});
