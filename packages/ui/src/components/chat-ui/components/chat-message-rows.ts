import { getAssistantMessageActionTargetId, type MessageGroup, type SessionMessage } from "./message-types";

export type ChatMessageRow = {
  key: string;
  messageIds: string[];
  message: SessionMessage;
} & (
  | { type: "user"; endIndex: number }
  | { type: "response"; userIndex: number | null; showAssistantActions: boolean; isActiveTurn: boolean }
);

const singlePart = (message: SessionMessage) => (message.parts.length === 1 ? message.parts[0] : undefined);

const repeatablePrompt = (group: MessageGroup) => {
  const part = singlePart(group.userMessage);
  if (group.userMessage.delivery || part?.type !== "text") return;
  if (group.responses.every((response) => singlePart(response)?.type === "error")) return part.text;
};

export const buildChatMessageRows = (leadingResponses: SessionMessage[], groups: MessageGroup[], streaming = false) => {
  const rows: ChatMessageRow[] = [];

  const appendResponses = (responses: SessionMessage[], userIndex: number | null, isActiveTurn: boolean) => {
    const actionId = getAssistantMessageActionTargetId(responses, streaming && isActiveTurn);
    for (const message of responses) {
      const part = singlePart(message);
      const previous = rows.at(-1);
      const previousPart = previous && singlePart(previous.message);
      if (
        part?.type === "error" &&
        previous?.type === "response" &&
        previous.userIndex === userIndex &&
        previous.message.role === message.role &&
        previousPart?.type === "error" &&
        previousPart.errorType === part.errorType &&
        previousPart.message === part.message
      ) {
        previous.messageIds.push(message.id);
        continue;
      }
      rows.push({
        type: "response",
        key: message.id,
        message,
        messageIds: [message.id],
        userIndex,
        showAssistantActions: message.id === actionId,
        isActiveTurn,
      });
    }
  };

  appendResponses(leadingResponses, null, groups.length === 0);
  for (let index = 0; index < groups.length; index++) {
    const group = groups[index];
    const userIndex = rows.length;
    const prompt = repeatablePrompt(group);
    let last = index;
    while (prompt !== undefined && last + 1 < groups.length && repeatablePrompt(groups[last + 1]) === prompt) last++;
    const userRow: ChatMessageRow = {
      type: "user",
      key: group.userMessage.id,
      message: group.userMessage,
      messageIds: groups.slice(index, last + 1).map((turn) => turn.userMessage.id),
      endIndex: userIndex,
    };
    rows.push(userRow);
    const responses =
      last === index ? group.responses : groups.slice(index, last + 1).flatMap((turn) => turn.responses);
    appendResponses(responses, userIndex, last === groups.length - 1);
    userRow.endIndex = rows.length - 1;
    index = last;
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
