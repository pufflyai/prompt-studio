import { PstdioApiError } from "./request";

// These responses reject the subscription before it can acquire a claim.
// Timeouts and rate limits can recover without changing the requested session.
export const isSessionStreamRejection = (error: unknown): error is PstdioApiError =>
  error instanceof PstdioApiError &&
  error.status >= 400 &&
  error.status < 500 &&
  error.status !== 408 &&
  error.status !== 429;
