import type { ResourceRef } from "@pstdio/sdk/extensions";
import { normalizeChatMessagesForDisplay, resolveQuestionPrompt } from "@pstdio/ui/chat-ui";
import { useCallback, useState } from "react";
import type { WorkbenchModuleContext } from "../../../core";
import type { ChatSession } from "../../../extensions/contributions/chat-session";
import { useObservedResource } from "../../resource-changes/activity-dot";

export const useNativeChatObservation = (
  props: { workbench?: WorkbenchModuleContext; resource?: ResourceRef; visible?: boolean },
  state: ReturnType<ChatSession["getSnapshot"]>,
) => {
  const [visibleMessageIds, setVisibleMessageIds] = useState<string[]>([]);
  const [visibleQuestionId, setVisibleQuestionId] = useState<string>();
  const onVisibleMessageIdsChange = useCallback(
    (ids: string[]) =>
      setVisibleMessageIds((old) => (old.length === ids.length && old.every((id) => ids.includes(id)) ? old : ids)),
    [],
  );
  const { conversation } = state;
  let witnessed = state.messages.length === 0;
  if (conversation.observedChangeMessageIds?.length === 0)
    witnessed = normalizeChatMessagesForDisplay(state.messages, { streaming: conversation.streaming }).length === 0;
  if (conversation.observedChangeMessageIds?.length)
    witnessed = conversation.observedChangeMessageIds.every((id) => visibleMessageIds.includes(id));
  const questionId = conversation.observedChangeQuestionId;
  const question = questionId && resolveQuestionPrompt(state.messages, questionId);
  if (questionId && (questionId.startsWith("approval:") || (question && question.delivery !== "async")))
    witnessed = visibleQuestionId === questionId;
  useObservedResource(
    props.workbench,
    props.resource,
    conversation.observedChange,
    props.visible !== false && !state.loading && !state.initializing && !state.error && witnessed,
  );
  return {
    onVisibleMessageIdsChange: conversation.observedChange ? onVisibleMessageIdsChange : undefined,
    onVisibleQuestionChange: conversation.observedChange ? setVisibleQuestionId : undefined,
  };
};
