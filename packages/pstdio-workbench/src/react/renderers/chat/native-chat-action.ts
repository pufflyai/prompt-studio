import type { ChatRendererAction } from "@pstdio/sdk/extensions";
import { chatRendererActionResultSchema } from "pstdio-api-contracts";
import type { ChatSession } from "../../../extensions/contributions/chat-session";

/** A queued control edits isolated request settings, not the base composer's values. */
export const runNativeChatAction = (
  session: ChatSession,
  action: ChatRendererAction,
  handler: Parameters<ChatSession["run"]>[1],
  editingQueue: boolean,
) =>
  session.run(
    action,
    editingQueue && action.type === "control" && handler
      ? async (input) => {
          const result = chatRendererActionResultSchema.parse((await handler(input)) ?? {});
          if (!result.snapshot) return result;
          const { values: _queuedValues, ...snapshot } = result.snapshot;
          return { ...result, snapshot };
        }
      : handler,
  );

/** A failed queued input already belongs to the owner's durable recovery, not the editor's catch-and-restore path. */
export const handoffNativeChatInput = async (session: ChatSession, send: () => Promise<unknown>) => {
  const failures = new Set(
    session
      .getSnapshot()
      .pending?.filter((item) => item.failure)
      .map((item) => item.message.id),
  );
  try {
    return await send();
  } catch (error) {
    if (!session.getSnapshot().pending?.some((item) => item.failure && !failures.has(item.message.id))) throw error;
    return;
  }
};
