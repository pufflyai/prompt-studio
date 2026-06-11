import type { ErrorPart, SessionMessage, ToolPartActionType } from "@pstdio/sdk/extensions";

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
