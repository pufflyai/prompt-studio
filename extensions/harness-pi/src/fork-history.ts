import { SessionManager } from "@earendil-works/pi-coding-agent";
import { piEntryMessage } from "./history";
import { normalizePiMessages } from "./messages";

export const forkPiHistory = (path: string, messageId: string, signal: AbortSignal) => {
  const manager = SessionManager.open(path);
  const entries = manager.getBranch().flatMap((entry) => {
    const message = piEntryMessage(entry);
    return message ? [{ entry, message }] : [];
  });
  let boundary: number | undefined;
  normalizePiMessages(
    entries.map(({ message }) => message),
    0,
    (id, index) => {
      if (id === messageId) boundary = index;
    },
  );
  if (boundary === undefined) throw new Error("The selected reply is missing from Pi history.");
  const prefix = normalizePiMessages(entries.slice(0, boundary + 1).map(({ message }) => message));
  if (prefix.at(-1)?.id !== messageId)
    throw new Error("This reply's tool results cross a later message. Choose a later reply to fork.");
  signal.throwIfAborted();
  manager.createBranchedSession(entries[boundary].entry.id);
  return { agentSessionId: manager.getSessionId() };
};
