import type { SessionMessage } from "./message-types";

export const MAX_RECENT_USER_PROMPTS = 10;

export const getRecentUserPrompts = (messages: SessionMessage[]) => {
  const prompts: string[] = [];
  for (let i = messages.length - 1; i >= 0 && prompts.length < MAX_RECENT_USER_PROMPTS; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const text = message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");
    if (text.trim()) prompts.push(text);
  }
  return prompts;
};

export const movePromptHistory = (
  index: number | null,
  direction: "previous" | "next",
  text: string,
  count: number,
) => {
  if (count === 0) return null;
  if (index === null) {
    return direction === "previous" && text === "" ? { index: 0 } : null;
  }
  if (direction === "previous") return { index: Math.min(index + 1, count - 1) };
  return { index: index === 0 ? null : index - 1 };
};
