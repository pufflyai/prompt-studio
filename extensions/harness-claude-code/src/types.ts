export type ClaudeCodeContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: unknown; is_error?: boolean };

export type ClaudeCodeTranscriptEntry = {
  uuid: string;
  type: string;
  message: {
    role: string;
    content: string | ClaudeCodeContentBlock[];
  };
  toolUseResult?: unknown;
};

export type RawLogEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "session_id"; sessionId: string }
  | { type: "ready" }
  | { type: "finished" };

export const parseStdoutLine = (data: string) => {
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
};
