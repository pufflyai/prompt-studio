import { eventRef } from "@pstdio/sdk/extensions";

export const marmaladeChanged = eventRef<Record<string, never>>({
  extensionId: "pstdio.extension-lab",
  id: "marmalade.changed",
});
