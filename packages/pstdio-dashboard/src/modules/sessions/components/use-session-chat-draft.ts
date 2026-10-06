import { useState } from "react";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";

// The chat panel is keyed by its draft key, so the stored draft is read once per conversation.
// The live text stays here so the composer can return to it, for example after a queued edit.
export const useSessionChatDraft = (drafts: DashboardSessionDraftPersistence | undefined, draftKey: string) => {
  const [text, setText] = useState(() => drafts?.getDraft(draftKey) ?? "");

  return {
    text,
    change: (next: string) => {
      setText(next);
      drafts?.setDraft(draftKey, next);
    },
  };
};
