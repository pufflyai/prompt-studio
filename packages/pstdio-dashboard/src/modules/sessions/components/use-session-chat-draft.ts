import { useEffect, useRef, useState } from "react";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";

// The chat input owns its editing state and only re-seeds when the seed value changes, so the
// stored draft is read once per conversation and written on every keystroke — never fed back
// into the seed while the user types.
export const useSessionChatDraft = (drafts: DashboardSessionDraftPersistence | undefined, draftKey: string) => {
  const [seed, setSeed] = useState(() => drafts?.getDraft(draftKey) ?? "");
  const seededKeyRef = useRef(draftKey);

  useEffect(() => {
    if (seededKeyRef.current === draftKey) return;
    seededKeyRef.current = draftKey;
    setSeed(drafts?.getDraft(draftKey) ?? "");
  }, [draftKey, drafts]);

  return {
    seed,
    change: (text: string) => drafts?.setDraft(draftKey, text),
    clear: () => {
      drafts?.setDraft(draftKey, "");
      setSeed("");
    },
  };
};
