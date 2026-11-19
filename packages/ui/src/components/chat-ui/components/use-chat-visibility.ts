import { useCallback, useEffect, useMemo } from "react";
import type { ChatPanelProps } from "./chat-panel";
import { chatVisibilitySourceIds } from "./chat-visibility-sources";
import type { SessionMessage } from "./message-types";

export const useChatVisibility = (
  props: Pick<ChatPanelProps, "hideComposer" | "messages" | "onVisibleQuestionChange" | "onVisibleMessageIdsChange">,
  ready: boolean,
  questionId: string | undefined,
  displayed: SessionMessage[],
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
    () => (visibleMessages ? chatVisibilitySourceIds(messages, displayed) : undefined),
    [visibleMessages, messages, displayed],
  );
  const onRows = useCallback(
    (rows: string[]) => visibleMessages?.(sourceIds?.(rows) ?? []),
    [visibleMessages, sourceIds],
  );
  return ready && visibleMessages ? onRows : undefined;
};
