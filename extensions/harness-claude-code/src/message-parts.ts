import type {
  ErrorPart,
  SessionMessage,
  SessionMessagePart,
  ToolPart,
  ToolPartActionType,
} from "@pstdio/sdk/extensions";
import type { AskUserQuestionInput, ClaudeCodeToolResultBlock, ClaudeCodeToolUseBlock } from "./types";

const READ_TOOLS = new Set(["Read", "Glob", "Grep"]);
const WRITE_TOOLS = new Set(["Write", "Edit", "NotebookEdit", "TodoWrite"]);
const EXECUTE_TOOLS = new Set(["Bash", "Task"]);
const NETWORK_TOOLS = new Set(["WebFetch", "WebSearch"]);

export const classifyToolAction = (toolName: string): ToolPartActionType => {
  if (READ_TOOLS.has(toolName)) return "read";
  if (WRITE_TOOLS.has(toolName)) return "write";
  if (EXECUTE_TOOLS.has(toolName)) return "execute";
  if (NETWORK_TOOLS.has(toolName)) return "network";
  return "other";
};

export const ASK_USER_QUESTION = "AskUserQuestion";

// The neutral tool the chat question form reads, shared with the other harnesses.
const QUESTION_TOOL = "question";

const QUESTION_UNAVAILABLE = "This question is no longer available.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// `custom` offers Other. Claude accepts a typed answer that matches none of its options.
const toQuestionInput = (input: unknown) => {
  const questions = (input as Partial<AskUserQuestionInput> | null)?.questions;
  // Invalid tool inputs still reach the chat before Claude reports their schema error.
  if (!Array.isArray(questions) || !questions.every(isRecord)) return input;
  return {
    questions: questions.map(({ multiSelect, ...question }) => ({
      ...question,
      multiple: multiSelect === true,
      custom: true,
    })),
  };
};

export const toolUsePart = (block: ClaudeCodeToolUseBlock): ToolPart => {
  const isQuestion = block.name === ASK_USER_QUESTION;
  const tool = isQuestion ? QUESTION_TOOL : block.name;
  return {
    type: "tool",
    tool,
    callId: block.id,
    actionType: classifyToolAction(tool),
    status: "pending",
    state: { input: isQuestion ? toQuestionInput(block.input) : block.input },
  };
};

/** `tool` is the name `toolUsePart` gave the call, so a question result stays a question. */
export const toolResultPart = (tool: string, block: ClaudeCodeToolResultBlock, toolUseResult?: unknown): ToolPart => {
  const isError = block.is_error === true;
  const isQuestion = tool === QUESTION_TOOL;
  // Claude stores an answer as `{ questions, answers }`, which the question form cannot read as a
  // reply. Claude's own text says what the person chose, or that they skipped, so keep that instead.
  const output =
    !isQuestion && isRecord(toolUseResult) ? { ...toolUseResult, returnDisplay: block.content } : block.content;
  const errorText = isQuestion && typeof block.content === "string" ? block.content : "Tool execution failed";

  return {
    type: "tool",
    tool,
    callId: block.tool_use_id,
    actionType: classifyToolAction(tool),
    status: isError ? "failed" : "completed",
    state: { output, errorText: isError ? errorText : undefined },
  };
};

export const isOpenQuestion = (part: SessionMessagePart): part is ToolPart =>
  part.type === "tool" && part.tool === QUESTION_TOOL && (part.status === "pending" || part.status === "running");

/** Closes a question whose Claude process ended before the person answered. Nobody can answer it now. */
export const closeQuestionPart = (part: ToolPart): ToolPart => ({
  ...part,
  status: "failed",
  state: { ...part.state, output: QUESTION_UNAVAILABLE, errorText: QUESTION_UNAVAILABLE },
});

export const mergeToolResultMessage = (previous: SessionMessage, message: SessionMessage): SessionMessage => {
  const previousPart = previous.parts[0];
  const nextPart = message.parts[0];

  if (previousPart?.type !== "tool" || nextPart?.type !== "tool") return message;

  const previousState = previousPart.state;
  const nextState = nextPart.state;
  const state =
    previousState || nextState
      ? {
          ...previousState,
          ...nextState,
          input: nextState?.input ?? previousState?.input,
        }
      : undefined;

  return {
    ...message,
    parts: [
      {
        ...nextPart,
        state,
      },
    ],
  };
};

const PERMISSION_ERROR_PATTERN =
  /(permission denied|forbidden|unauthorized|access denied|eacces|operation not permitted)/i;
const TIMEOUT_ERROR_PATTERN = /(timed out|timeout|deadline exceeded|etimedout)/i;
const CRASH_ERROR_PATTERN = /(crash|crashed|panic|fatal|segmentation fault|assertion failed)/i;

export const normalizeErrorPart = (input: { errorType?: string; message?: string }): ErrorPart => {
  const message = input.message?.trim();

  if (input.errorType) {
    const known = ["permission", "timeout", "crash", "other"].includes(input.errorType)
      ? (input.errorType as ErrorPart["errorType"])
      : "other";
    return {
      type: "error",
      errorType: known,
      message: message && message.length > 0 ? message : undefined,
    };
  }

  if (message && PERMISSION_ERROR_PATTERN.test(message)) {
    return { type: "error", errorType: "permission", message };
  }

  if (message && TIMEOUT_ERROR_PATTERN.test(message)) {
    return { type: "error", errorType: "timeout", message };
  }

  if (message && CRASH_ERROR_PATTERN.test(message)) {
    return { type: "error", errorType: "crash", message };
  }

  return { type: "error", errorType: "other", message: message && message.length > 0 ? message : undefined };
};
