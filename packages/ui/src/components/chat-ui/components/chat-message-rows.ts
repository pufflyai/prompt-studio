import { getAssistantMessageActionTargetId, type MessageGroup, type SessionMessage } from "./message-types";

export type ChatMessageRow = {
  key: string;
  message: SessionMessage;
} & (
  | { type: "user"; endIndex: number }
  | { type: "response"; userIndex: number | null; showAssistantActions: boolean; isActiveTurn: boolean }
);

export const buildChatMessageRows = (leadingResponses: SessionMessage[], groups: MessageGroup[]) => {
  const leadingActionId = getAssistantMessageActionTargetId(leadingResponses);
  const rows: ChatMessageRow[] = leadingResponses.map((message) => ({
    type: "response",
    key: message.id,
    message,
    userIndex: null,
    showAssistantActions: message.id === leadingActionId,
    isActiveTurn: groups.length === 0,
  }));
  for (const [groupIndex, group] of groups.entries()) {
    const userIndex = rows.length;
    const actionId = getAssistantMessageActionTargetId(group.responses);
    rows.push({
      type: "user",
      key: group.userMessage.id,
      message: group.userMessage,
      endIndex: userIndex + group.responses.length,
    });
    for (const message of group.responses) {
      rows.push({
        type: "response",
        key: message.id,
        message,
        userIndex,
        showAssistantActions: message.id === actionId,
        isActiveTurn: groupIndex === groups.length - 1,
      });
    }
  }
  return rows;
};

export const getChatStickyRowIndex = (rows: ChatMessageRow[], index: number) => {
  const row = rows[index];
  return row?.type === "user" ? index : (row?.userIndex ?? null);
};

export const hasChatRowGap = (rows: ChatMessageRow[], index: number) => {
  const next = rows[index + 1];
  return Boolean(next) && (next.type === "user" || getChatStickyRowIndex(rows, index) === null);
};
