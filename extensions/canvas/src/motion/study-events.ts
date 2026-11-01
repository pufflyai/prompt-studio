import { eventRef } from "@pstdio/sdk/extensions";
export const studiesChanged = eventRef<{ studies?: string[] }>({
  extensionId: "pstdio.canvas",
  id: "studies.changed",
});
