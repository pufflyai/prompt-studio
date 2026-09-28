export interface SessionNotice {
  message: string;
  // Only a temporary failure is worth retrying; a permanent one would fail the same way.
  temporary: boolean;
}

// No response at all, a server error, a timeout, or rate limiting can succeed on a later try.
export const toSessionNotice = (error: unknown): SessionNotice => {
  const status = (error as { status?: unknown } | null)?.status;
  return {
    message: error instanceof Error ? error.message : String(error),
    temporary: typeof status !== "number" || status >= 500 || status === 408 || status === 429,
  };
};
