export interface SessionNotice {
  message: string;
  // Only a temporary failure is worth retrying; a permanent one would fail the same way.
  temporary: boolean;
}

// No response at all, a server error, a timeout, or rate limiting can succeed on a later try.
export const toSessionNotice = (error: unknown): SessionNotice => {
  const status = (error as { status?: unknown } | null)?.status;
  // fetch rejects with a TypeError when no response arrives; its text ("Failed to fetch") means nothing to users.
  const unreachable = typeof status !== "number" && error instanceof TypeError;
  const message = error instanceof Error ? error.message : String(error);
  return {
    message: unreachable ? "The network is unavailable." : message,
    temporary: typeof status !== "number" || status >= 500 || status === 408 || status === 429,
  };
};
