import type { ChatDraft, ChatRendererAction, ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { recoverChatDraft } from "./chat-draft-recovery";
import { type ChatPendingSubmission, createChatPendingSubmission } from "./chat-pending-submission";

type Submit = Extract<ChatRendererAction, { type: "submit" }>;
type Handler = (action: ChatRendererAction) => Promise<unknown>;

/** The resource owner keeps a single in-flight handoff even while its presentation is closed. */
export const createChatSubmissionRunner = (input: {
  read(): { draft: ChatDraft; conversation: ChatRendererSnapshot; edits: number; pending?: ChatPendingSubmission[] };
  execute(action: ChatRendererAction, handler: Handler): Promise<{ snapshot?: ChatRendererSnapshot }>;
  publish(update: { sending: boolean; pending?: ChatPendingSubmission[]; error?: string }): void;
  changeDraft(draft: Partial<ChatDraft>): void;
  fail(error: unknown): void;
  markRecoverable(): void;
}) => {
  let submission: Promise<void> | undefined;
  return (action: Submit, handler: Handler) => {
    if (submission) return submission;
    const before = input.read();
    const pending =
      !action.questionResponse && !before.conversation.streaming
        ? createChatPendingSubmission(action, before.conversation.messages ?? [])
        : undefined;
    input.publish({ sending: true, pending: [...(before.pending ?? []), ...(pending ? [pending] : [])] });
    submission = input
      .execute(action, handler)
      .then((result) => {
        const current = input.read();
        // Submitted-input tags are an explicit alternative to a canonical user echo
        // (for example an acknowledged native operation that produces no chat message).
        const terminal =
          result.snapshot &&
          ("sentTag" in result.snapshot ||
            (result.snapshot.messages !== undefined && result.snapshot.streaming === false));
        input.publish({
          sending: false,
          pending: current.pending?.flatMap((item) => {
            if (item.message.id !== pending?.message.id) return [item];
            return terminal ? [] : [{ ...item, accepted: true }];
          }),
        });
        if (!action.questionResponse && input.read().edits === before.edits) {
          input.changeDraft({ text: "", attachments: [] });
          input.markRecoverable();
        }
      })
      .catch((error) => {
        if (!action.questionResponse) {
          const failed = { text: action.text, attachments: action.attachments, values: action.values };
          const current = input.read();
          input.changeDraft(recoverChatDraft(current.draft, failed, current.edits === before.edits));
        }
        input.publish({
          sending: false,
          pending: input.read().pending?.filter((item) => item.message.id !== pending?.message.id),
        });
        input.fail(error);
        throw error;
      })
      .finally(() => {
        submission = undefined;
        input.publish({ sending: false });
      });
    return submission;
  };
};
