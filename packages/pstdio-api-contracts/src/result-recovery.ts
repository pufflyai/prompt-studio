import type { SessionMessage, ToolPart } from "./session-messages";
import { normalizeMessageResults, toolOutputFingerprint } from "./tool-result";

/** Compare the same bounded view while preserving the summary a person already saw. */
export const projectToolResultRecovery = (known: readonly SessionMessage[], native: readonly SessionMessage[]) => {
  const knownMessages = known.map(normalizeMessageResults);
  const nativeMessages = native.map(normalizeMessageResults);
  const summaries = new Map<string, ToolPart>();
  const key = (message: SessionMessage, part: ToolPart, index: number) =>
    part.callId ? `${part.tool}:${part.callId}` : `${message.id}:${index}:${part.tool}`;
  for (const message of [...knownMessages, ...nativeMessages]) {
    message.parts.forEach((part, index) => {
      if (part.type !== "tool" || !part.state?.resultSummary) return;
      const identity = key(message, part, index);
      if (!summaries.has(identity)) summaries.set(identity, part);
    });
  }
  const project = (message: SessionMessage) => ({
    ...message,
    parts: message.parts.map((part, index) => {
      if (part.type !== "tool") return part;
      const saved = summaries.get(key(message, part, index));
      if (!saved || toolOutputFingerprint(saved) !== toolOutputFingerprint(part)) return part;
      const {
        output: _output,
        errorText: _error,
        metadata: _metadata,
        resultSummary: _summary,
        ...rest
      } = part.state ?? {};
      return { ...part, state: { ...rest, output: saved.state?.output, resultSummary: saved.state?.resultSummary } };
    }),
  });
  return { knownMessages: knownMessages.map(project), nativeMessages: nativeMessages.map(project) };
};
