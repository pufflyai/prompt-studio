import type { ChatDraft, ChatRendererAction, ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { UnresolvedSubmissionError } from "@pstdio/ui";
import { discardPendingChatSubmission } from "./chat-draft-restoration";
import { returnFailedChatInput } from "./chat-failed-submission";
import { type ChatPendingSubmission, createChatPendingSubmission } from "./chat-pending-submission";

type Submit = Extract<ChatRendererAction, { type: "submit" }>;
type Handler = (action: ChatRendererAction) => Promise<unknown>;
export type TrackChatSubmission = <T>(action: Submit, execute: () => Promise<T>, discard: () => void) => Promise<T>;

/** The resource owner keeps a single in-flight handoff even while its presentation is closed. */
export const createChatSubmissionRunner = (input: {
  read(): {
    draft: ChatDraft;
    conversation: ChatRendererSnapshot;
    edits: number;
    active?: boolean;
    pending?: ChatPendingSubmission[];
  };
  execute(action: ChatRendererAction, handler: Handler): Promise<{ snapshot?: ChatRendererSnapshot }>;
  publish(update: { sending?: boolean; pending?: ChatPendingSubmission[]; error?: string }): void;
  changeDraft(draft: Partial<ChatDraft>): void;
  fail(error: unknown): void;
  trackSubmission?: TrackChatSubmission;
}) => {
  let submission: Promise<void> | undefined;
  let sequence = 0;
  return (action: Submit, handler: Handler, invocation?: Pick<typeof input, "execute" | "changeDraft">) => {
    if (submission) return submission;
    const source = { ...input, ...invocation };
    const before = source.read();
    const retained = before.pending?.find((item) => item.unresolved?.recovery.isRetained());
    if (retained) return Promise.reject(retained.unresolved);
    sequence = Math.max(sequence, ...(before.pending ?? []).map((item) => item.sequence));
    const pending = !action.questionResponse
      ? createChatPendingSubmission(
          action,
          before.conversation.messages ?? [],
          before.conversation.queuedFollowUps ?? [],
          Boolean(before.conversation.streaming),
          ++sequence,
        )
      : undefined;
    source.publish({ sending: true, pending: [...(before.pending ?? []), ...(pending ? [pending] : [])] });
    const execute = () => source.execute(action, handler);
    const discard = () => {
      if (pending && source.read().active !== false) discardPendingChatSubmission(source, pending.message.id);
    };
    submission = (
      source.trackSubmission && !action.questionResponse ? source.trackSubmission(action, execute, discard) : execute()
    )
      .then((result) => {
        const current = source.read();
        // Submitted-input tags are an explicit alternative to a canonical user echo
        // (for example an acknowledged native operation that produces no chat message).
        const terminal =
          result.snapshot &&
          ("sentTag" in result.snapshot ||
            (!pending?.queue && result.snapshot.messages !== undefined && result.snapshot.streaming === false));
        source.publish({
          sending: false,
          pending: current.pending?.flatMap((item) => {
            if (item.message.id !== pending?.message.id) return [item];
            return terminal ? [] : [{ ...item, accepted: true }];
          }),
        });
        if (!action.questionResponse && source.read().edits === before.edits)
          source.changeDraft({ text: "", attachments: [] });
      })
      .catch((error) => {
        const current = source.read();
        const unchanged = current.edits === before.edits;
        const failed = { text: action.text, attachments: action.attachments };
        const returnInput = () => {
          if (action.questionResponse) return;
          const draft = source.read().draft;
          const returned = returnFailedChatInput(draft, failed);
          if (returned !== draft) source.changeDraft(returned);
        };
        if (error instanceof UnresolvedSubmissionError && pending) {
          // Sending stays blocked until delivery is known, so the input can wait in the composer.
          if (unchanged) returnInput();
          const draftEdits = unchanged ? source.read().edits : undefined;
          source.publish({
            sending: false,
            pending: current.pending?.map((item) =>
              item.message.id === pending.message.id
                ? { ...item, failure: error.message, unresolved: error, draftEdits }
                : item,
            ),
          });
          throw error;
        }
        const queued = current.pending?.find((item) => item.message.id === pending?.message.id && item.queue);
        if (queued && !queued.echoed) {
          // The failed row offers Restore draft; closing it discards the message.
          source.publish({
            sending: false,
            pending: current.pending?.map((item) =>
              item === queued ? { ...item, failure: error instanceof Error ? error.message : String(error) } : item,
            ),
          });
          throw error;
        }
        if (!queued?.echoed) returnInput();
        source.publish({
          sending: false,
          pending: source.read().pending?.filter((item) => item.message.id !== pending?.message.id),
        });
        source.fail(error);
        throw error;
      })
      .finally(() => {
        submission = undefined;
        source.publish({ sending: false });
      });
    return submission;
  };
};
