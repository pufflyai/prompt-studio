import { PstdioApiError, PstdioConnectionError } from "@pstdio/sdk/client";
import { CommandOutcomeError } from "@pstdio/sdk/extensions";

export const classifyApiWrite = (error: unknown) => {
  if (error instanceof CommandOutcomeError) return error.outcome.status === "rejected" ? "rejected" : "unknown";
  if (error instanceof PstdioConnectionError || error instanceof SyntaxError) return "unknown";
  if (error instanceof PstdioApiError && (error.status === 408 || error.status >= 500)) return "unknown";
  if (error instanceof DOMException && error.name === "AbortError") return "unknown";
  return "rejected";
};
