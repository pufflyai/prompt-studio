import type { ChatDraft, ChatRendererAction, ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { createChatDecisions } from "./chat-decisions";
import { createChatDraftValues } from "./chat-draft-values";

const latestChatFields = (incoming: ChatRendererSnapshot, clocks: Map<string, number>, issued: number) => {
  const current = (key: string) => {
    if ((clocks.get(key) ?? -1) > issued) return false;
    clocks.set(key, issued);
    return true;
  };
  const { values, ...fields } = incoming;
  return {
    ...Object.fromEntries(Object.entries(fields).filter(([key]) => current(key))),
    ...(values && { values: Object.fromEntries(Object.entries(values).filter(([key]) => current(`values.${key}`))) }),
  } as ChatRendererSnapshot;
};
export const createChatSnapshot = (initial?: ChatRendererSnapshot) => {
  const clocks = new Map<string, number>();
  const values = createChatDraftValues();
  const decisions = createChatDecisions(initial);
  return {
    values,
    merge(
      state: { conversation: ChatRendererSnapshot; draft: ChatDraft },
      incoming: ChatRendererSnapshot,
      issued: number,
      expectedValues?: Map<string, number>,
      action?: ChatRendererAction,
    ) {
      const snapshot = decisions(
        state.conversation,
        latestChatFields(incoming, clocks, issued),
        action?.type === "decision" && incoming.decision === null ? action.id : undefined,
        Boolean(action && incoming.decision),
        issued,
      );
      // Ignored query defaults are presentation updates, not changes to locally owned draft controls.
      const updated = values.snapshot(state.draft, expectedValues ? incoming.values : snapshot.values, expectedValues);
      return {
        state: {
          conversation: {
            ...state.conversation,
            ...snapshot,
            values: { ...state.conversation.values, ...snapshot.values },
          },
          draft: updated.draft,
        },
        valuesChanged: updated.changed,
      };
    },
  };
};
