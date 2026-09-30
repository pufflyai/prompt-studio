import { eventRef } from "@pstdio/sdk/extensions";
export const studiesChanged = eventRef<{ studies?: string[] }>({
  extensionId: "pstdio.motion-lab",
  id: "studies.changed",
});
