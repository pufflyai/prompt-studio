import type { ComposerIntent } from "./composer-command";

export interface SubmittedCommand {
  intent: ComposerIntent;
  objective: string;
}
type NativeCommandDraft = { harnessId: string; submitted?: SubmittedCommand } & (
  | { kind: "pending"; text: string; previousRequest: string | null | undefined; message?: string }
  | { kind: "outcome"; message?: string }
);

// Creating a session can remount the composer. Transfer its pending native input
// to that session's composer so a later native failure can restore the draft.
const handedOff = new Map<string, NativeCommandDraft>();
export const handOffNativeCommand = (sessionId: string, command: NativeCommandDraft) =>
  handedOff.set(sessionId, command);
export const takeNativeCommand = (sessionId: string | null, harnessId: string) => {
  if (!sessionId) return null;
  const command = handedOff.get(sessionId);
  if (!command || command.harnessId !== harnessId) return null;
  handedOff.delete(sessionId);
  return command;
};
