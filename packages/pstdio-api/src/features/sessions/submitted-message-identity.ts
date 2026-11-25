import type { SessionMessage, SessionMessageSender } from "pstdio-api-contracts";

export const submittedMessageText = (message: SessionMessage) =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

// Harnesses may append their generated file manifest to the visible prompt.
const attachmentManifest =
  /^\n\n<session-attachments>\n(?:- name="(?:[^"\\\r\n]|\\.)*" path="(?:[^"\\\r\n]|\\.)*" mime=(?:null|"(?:[^"\\\r\n]|\\.)*") size=\d+\n)+<\/session-attachments>$/;

export const matchesSubmittedPrompt = (text: string, prompt?: string) => {
  if (prompt === undefined) return false;
  const expected = prompt.trim();
  if (text === expected) return true;
  const manifestStart = text.lastIndexOf("\n\n<session-attachments>\n");
  return (
    manifestStart !== -1 &&
    text.slice(0, manifestStart).trim() === expected &&
    attachmentManifest.test(text.slice(manifestStart))
  );
};

export const submittedRequestId = (sessionId: string, position: number) => `${sessionId}:${position}`;
export const submittedMessageSender = (input: {
  sessionId: string;
  submittedQueuePosition?: number;
  sender?: SessionMessageSender;
}) => {
  if (!input.sender || input.submittedQueuePosition === undefined) return input.sender;
  const { type, id, name } = input.sender;
  return { type, id, name, requestId: submittedRequestId(input.sessionId, input.submittedQueuePosition) };
};
