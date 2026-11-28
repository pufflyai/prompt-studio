import { type ChatMessageRow, isChatMessageContinuation } from "./chat-message-rows";
import type { SessionMessage } from "./message-types";

const excerpt = (message: SessionMessage) => {
  const text = message.parts.find((part) => part.type === "text" && part.text.trim());
  if (text?.type === "text") return text.text.trim().slice(0, 240);
  const file = message.parts.find((part) => part.type === "file");
  return file?.filename ?? "";
};

export const getOutlineEntries = (rows: ChatMessageRow[]) => {
  const entries: Array<{ id: string; index: number; prompt: string; reply: string }> = [];
  const messageCount = rows.reduce(
    (count, row) => (isChatMessageContinuation(row) ? count : count + row.messageIds.length),
    0,
  );
  if (messageCount <= 2) return entries;
  for (const [index, row] of rows.entries()) {
    if (row.type === "user") {
      const prompt = excerpt(row.message) || "Message";
      for (const id of row.messageIds) entries.push({ id, index, prompt, reply: "" });
    } else if (row.message.role === "assistant" && !isChatMessageContinuation(row)) {
      const turn = entries.at(-1);
      if (turn && !turn.reply) turn.reply = excerpt(row.message);
    }
  }
  return entries;
};
