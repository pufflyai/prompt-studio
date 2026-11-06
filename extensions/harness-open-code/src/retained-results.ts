import { normalizeToolResult } from "@pstdio/sdk/extensions";
import type { OpencodeSessionMessage } from "./opencode-types";

// Polling still reads native history, but retained polling state owns bounded results only.
export const retainOpencodeResults = (messages: OpencodeSessionMessage[]) =>
  messages.map((message) => {
    const source = "content" in message ? message.content : message.parts;
    if (!source) return message;
    const parts = source.map((part) => {
      if (part.type !== "tool") return part;
      const native = part.state;
      const bounded = normalizeToolResult({
        type: "tool",
        tool: part.tool ?? "unknown",
        state: native && {
          status: native.status,
          input: native.input,
          output: native.output,
          errorText: native.errorText ?? native.error,
          metadata: native.metadata,
          resultSummary: native.resultSummary,
        },
      });
      return { type: part.type, tool: part.tool, callID: part.callID, state: bounded.state };
    });
    return "content" in message ? { ...message, content: parts } : { ...message, parts };
  });
