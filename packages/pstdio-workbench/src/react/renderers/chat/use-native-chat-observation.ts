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
  const { conversation } = state;
  const { observedChange: receipt, observedChangeMessageIds: targetIds } = conversation;
  const canObserve = props.visible !== false && !state.loading && !state.initializing && !state.error;
  const [witness, setWitness] = useState<{ receipt: string; visible: string[]; seen: string[] }>();
  const [visibleQuestionId, setVisibleQuestionId] = useState<string>();
  const onVisibleMessageIdsChange = useCallback(
    (ids: string[]) => {
      if (!canObserve || !receipt || !targetIds?.length) return;
      const visible = targetIds.filter((id) => ids.includes(id));
      const focused = document.visibilityState === "visible" && document.hasFocus();
      setWitness((previous) => {
        const current = previous?.receipt === receipt ? previous : undefined;
        if (!current && visible.length === 0) return previous;
        if (current?.visible.length === visible.length && visible.every((id) => current.visible.includes(id)))
          return previous;
        const seen = current?.seen ?? [];
        // A receipt can span rows that cannot be on screen together.
        const newlySeen = focused && targetIds.length > 1 ? visible.filter((id) => !seen.includes(id)) : [];
        return { receipt, visible, seen: newlySeen.length ? [...seen, ...newlySeen] : seen };
      });
    },
    [canObserve, receipt, targetIds],
  );
  let witnessed = state.messages.length === 0;
  if (targetIds?.length === 0)
    witnessed = normalizeChatMessagesForDisplay(state.messages, { streaming: conversation.streaming }).length === 0;
  if (targetIds?.length)
    witnessed = Boolean(
      witness &&
        witness.receipt === receipt &&
        witness.visible.length > 0 &&
        targetIds.every((id) => witness.visible.includes(id) || witness.seen.includes(id)),
    );
  const questionId = conversation.observedChangeQuestionId;
  const question = questionId && resolveQuestionPrompt(state.messages, questionId);
  if (questionId && (questionId.startsWith("approval:") || (question && question.delivery !== "async")))
    witnessed = visibleQuestionId === questionId;
  useObservedResource(props.workbench, props.resource, receipt, canObserve && witnessed);
  return {
    onVisibleMessageIdsChange: receipt ? onVisibleMessageIdsChange : undefined,
    onVisibleQuestionChange: receipt ? setVisibleQuestionId : undefined,
  };
};
