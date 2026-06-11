import type { ErrorPart } from "@pstdio/sdk/extensions";

const PERMISSION_ERROR_PATTERN =
  /(permission denied|forbidden|unauthorized|access denied|eacces|operation not permitted)/i;
const TIMEOUT_ERROR_PATTERN = /(timed out|timeout|deadline exceeded|etimedout)/i;
const CRASH_ERROR_PATTERN = /(crash|crashed|panic|fatal|segmentation fault|assertion failed)/i;

const toKnownErrorType = (value: string): ErrorPart["errorType"] => {
  if (value === "permission") return "permission";
  if (value === "timeout") return "timeout";
  if (value === "crash") return "crash";
  return "other";
};

export const normalizeErrorPart = (input: { errorType?: string; message?: string }): ErrorPart => {
  const message = input.message?.trim();

  if (input.errorType) {
    return {
      type: "error",
      errorType: toKnownErrorType(input.errorType),
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
