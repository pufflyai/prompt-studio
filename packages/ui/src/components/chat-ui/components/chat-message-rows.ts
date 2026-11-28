import {
  getAssistantMessageActionTargetId,
  groupMessagesByTurn,
  type MessageGroup,
  projectChatMessages,
  type SessionMessage,
} from "./message-types";

export interface ChatMessagePartRange {
  start: number;
  end: number;
}

export type ChatMessageRow = {
  key: string;
  messageIds: string[];
  message: SessionMessage;
} & (
  | { type: "user"; endIndex: number }
  | {
      type: "response";
      userIndex: number | null;
      partRange?: ChatMessagePartRange;
      showAssistantActions: boolean;
      isActiveTurn: boolean;
      streaming: boolean;
    }
);

// Small response rows keep rich editors and tool views outside the viewport unmounted.
const MAX_RESPONSE_PARTS_PER_ROW = 4;

export const isChatMessageContinuation = (row: ChatMessageRow) =>
  row.type === "response" && row.partRange !== undefined && row.partRange.end < row.message.parts.length;

const singlePart = (message: SessionMessage) => (message.parts.length === 1 ? message.parts[0] : undefined);

const hasSameSender = (first: SessionMessage, second: SessionMessage) =>
  first.sender?.type === second.sender?.type &&
  first.sender?.id === second.sender?.id &&
  first.sender?.name === second.sender?.name;

const repeatablePrompt = (group: MessageGroup) => {
  const part = singlePart(group.userMessage);
  if (group.userMessage.delivery || part?.type !== "text") return;
  if (group.responses.every((response) => singlePart(response)?.type === "error")) return part.text;
};

const appendResponseRows = (rows: ChatMessageRow[], response: Extract<ChatMessageRow, { type: "response" }>) => {
  const { message, key } = response;
  const partCount = message.parts.length;
  if (partCount <= MAX_RESPONSE_PARTS_PER_ROW) {
    rows.push(response);
    return;
  }
  for (let start = 0; start < partCount; start += MAX_RESPONSE_PARTS_PER_ROW) {
    const end = Math.min(start + MAX_RESPONSE_PARTS_PER_ROW, partCount);
    const isLast = end === partCount;
    rows.push({
      ...response,
      // The offset stays with the same content as later parts stream in.
      key: start === 0 ? key : `chat-continuation:${key}:${start}`,
      partRange: { start, end },
      showAssistantActions: isLast && response.showAssistantActions,
    });
  }
};

export const buildChatMessageRows = (
  leadingResponses: SessionMessage[],
  groups: MessageGroup[],
  streaming = false,
  activityAnchors?: ReadonlyMap<string, string>,
) => {
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
        hasSameSender(previous.message, message) &&
        previousPart?.type === "error" &&
        previousPart.errorType === part.errorType &&
        previousPart.message === part.message
      ) {
        previous.messageIds.push(message.id);
        continue;
      }
      const isActionTarget = message.id === actionId;
      appendResponseRows(rows, {
        type: "response",
        key: activityAnchors?.get(message.id) ?? message.animationKey ?? message.id,
        message,
        messageIds: [message.id],
        userIndex,
        showAssistantActions: isActionTarget,
        isActiveTurn,
        streaming: streaming && isActiveTurn && isActionTarget,
      });
    }
  };

  appendResponses(leadingResponses, null, groups.length === 0);
  for (let index = 0; index < groups.length; index++) {
    const group = groups[index];
    const userIndex = rows.length;
    const prompt = repeatablePrompt(group);
    let last = index;
    while (
      prompt !== undefined &&
      last + 1 < groups.length &&
      repeatablePrompt(groups[last + 1]) === prompt &&
      hasSameSender(group.userMessage, groups[last + 1].userMessage)
    )
      last++;
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

export const buildChatTranscript = (messages: SessionMessage[], streaming: boolean) => {
  const display = projectChatMessages(messages, { streaming });
  const { groups, leadingResponses } = groupMessagesByTurn(display.messages);
  return {
    messages: display.messages,
    rows: buildChatMessageRows(leadingResponses, groups, streaming, display.activityAnchors),
  };
};

export const getChatStickyRowIndex = (rows: ChatMessageRow[], index: number) => {
  const row = rows[index];
  return row?.type === "user" ? index : (row?.userIndex ?? null);
};

export const hasChatRowGap = (rows: ChatMessageRow[], index: number) => {
  const next = rows[index + 1];
  return (
    Boolean(next) &&
    !isChatMessageContinuation(rows[index]) &&
    (next.type === "user" || getChatStickyRowIndex(rows, index) === null)
  );
};
