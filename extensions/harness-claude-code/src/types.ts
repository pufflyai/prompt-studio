export type ClaudeCodeToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };

export type ClaudeCodeToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: unknown;
  is_error?: boolean;
};

export type ClaudeCodeContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | ClaudeCodeToolUseBlock
  | ClaudeCodeToolResultBlock;

/** The input of Claude's AskUserQuestion tool. */
export type AskUserQuestionInput = {
  questions: Array<{
    question: string;
    header?: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
};

export type ClaudeCodeTranscriptEntry = {
  uuid: string;
  type: string;
  timestamp?: string;
  message: {
    role: string;
    content: string | ClaudeCodeContentBlock[];
  };
  toolUseResult?: unknown;
  /** Claude tags entries it wrote itself, such as the note that wakes it when a background task ends. */
  origin?: { kind?: string };
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
