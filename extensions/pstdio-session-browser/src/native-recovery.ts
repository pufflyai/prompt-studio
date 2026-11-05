import type { ChatDraft, ExtensionContextBase } from "@pstdio/sdk/extensions";
import { readNativeSubmissions, updateNativeSubmission } from "./native-submission";

/** Recover accepted user input, never an execution or transcript copy. A failed write leaves it pending. */
export const recoverNativeInputs = async (
  ctx: ExtensionContextBase,
  id: string,
  session: { status: string; lastRequestStarted: string | null },
  emit: (draft: ChatDraft) => Promise<void>,
  emitted = new Set<string>(),
) => {
  const pending = await readNativeSubmissions(ctx, id, true);
  for (const input of pending) {
    const recovering = input.value.state === "recovering";
    if (
      !recovering &&
      (["in_progress", "awaiting_input", "queued"].includes(session.status) ||
        session.lastRequestStarted === input.value.previousRequest)
    )
      continue;
    const failed = recovering || session.status === "failed" || session.status === "disconnected";
    if (failed) {
      if (emitted.has(input.recordId)) continue;
      await updateNativeSubmission(ctx, input.recordId, { state: "recovering" });
      await emit(input.body.draft);
      emitted.add(input.recordId);
    } else await updateNativeSubmission(ctx, input.recordId, { state: "confirmed" });
  }
};

const draftContent = (draft: ChatDraft) =>
  JSON.stringify({ text: draft.text, attachments: draft.attachments, values: draft.values });
/** A stream write is not a durable acknowledgement. Retire recovery only after the host saves the recovered body. */
export const acknowledgeNativeInputs = async (ctx: ExtensionContextBase, id: string, draft: ChatDraft) => {
  const saved = new Set([draftContent(draft), ...(draft.recovered ?? []).map(draftContent)]);
  for (const input of await readNativeSubmissions(ctx, id, true)) {
    if (input.value.state === "recovering" && saved.has(draftContent(input.body.draft)))
      await updateNativeSubmission(ctx, input.recordId, { state: "recovered" });
  }
};
