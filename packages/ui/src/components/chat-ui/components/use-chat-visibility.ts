import { useCallback, useEffect, useMemo } from "react";
import type { ChatMessageRow } from "./chat-message-rows";
import type { ChatPanelProps } from "./chat-panel";
import { chatVisibilitySourceIds } from "./chat-visibility-sources";

export const useChatVisibility = (
  props: Pick<ChatPanelProps, "hideComposer" | "messages" | "onVisibleQuestionChange" | "onVisibleMessageIdsChange">,
  ready: boolean,
  questionId: string | undefined,
  rows: ChatMessageRow[],
) => {
  const changed = props.onVisibleQuestionChange;
  const visibleQuestionId = props.hideComposer ? undefined : questionId;
  useEffect(() => {
    changed?.(visibleQuestionId);
    return () => changed?.(undefined);
  }, [changed, visibleQuestionId]);
  const visibleMessages = props.onVisibleMessageIdsChange;
  const messages = props.messages;
  const sourceIds = useMemo(
    () => (visibleMessages ? chatVisibilitySourceIds(messages, rows) : undefined),
    [visibleMessages, messages, rows],
  );
  const onRows = useCallback(
    (rows: string[]) => visibleMessages?.(sourceIds?.(rows) ?? []),
    [visibleMessages, sourceIds],
  );
  return ready && visibleMessages ? onRows : undefined;
};
