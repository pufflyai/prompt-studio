import { eventRef } from "@pstdio/sdk/extensions";

export const notesChanged = eventRef<{ noteId?: string }>({
  extensionId: "pstdio.pstdio-notes",
  id: "notes.changed",
});
