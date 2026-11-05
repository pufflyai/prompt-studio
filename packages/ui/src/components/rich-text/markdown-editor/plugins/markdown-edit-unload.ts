import type { TextEditingSession } from "@pstdio/sdk/extensions";

interface MarkdownEditUnloadInput {
  session?: TextEditingSession;
  pending: () => boolean;
  drain: () => void;
}

/** Browser unload cannot await receipts; keep buffered edits and the existing unsaved-text guard together. */
export const registerMarkdownEditUnload = (input: MarkdownEditUnloadInput) => {
  const { session, pending, drain } = input;
  if (!session || typeof window === "undefined") return () => {};
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!pending() && !session.getSnapshot().pending) return;
    drain();
    if (!session.getSnapshot().pending) return;
    void session.flush().catch(() => {});
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("beforeunload", beforeUnload);
  return () => window.removeEventListener("beforeunload", beforeUnload);
};
