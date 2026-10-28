import { eventRef } from "@pstdio/sdk/extensions";

export const examplesChanged = eventRef<{ name: string }>({
  extensionId: "pstdio.extension-lab",
  id: "examples.changed",
});
