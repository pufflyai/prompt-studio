import type { ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { useSyncExternalStore } from "react";
import type { ChatActionPreview } from "../../../extensions/contributions/chat-action-operations";
import type { ChatSession } from "../../../extensions/contributions/chat-session";

const empty: readonly ChatActionPreview[] = [];
const noActions = () => empty;
const noSubscription = () => () => {};

export const useNativeChatActions = (session: ChatSession, conversation: ChatRendererSnapshot) => {
  const actions = session.actionOperations;
  const pending = useSyncExternalStore(
    actions?.subscribe ?? noSubscription,
    actions?.getSnapshot ?? noActions,
    actions?.getSnapshot ?? noActions,
  );
  return {
    /** Every queue change still running, in submission order. */
    queue: pending.filter(({ intent }) => intent.action.type === "queue"),
    approval: pending.find(
      ({ intent }) => intent.action.type === "approve" && conversation.approval?.id === intent.action.id,
    ),
    stop: pending.find(
      ({ intent }) =>
        intent.action.type === "stop" &&
        conversation.streaming &&
        conversation.streamingStartedAt === intent.runStartedAt,
    ),
  };
};
