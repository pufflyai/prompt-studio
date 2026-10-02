import type { HarnessCommandContext, HarnessEventSink } from "@pstdio/sdk/extensions";
export const codexCommandInput = (
  input: HarnessCommandContext,
  events: HarnessEventSink,
  projectId?: string,
  signal?: AbortSignal,
) => ({
  ...input,
  prompt: "",
  events,
  signal,
  env: { PSTDIO_SESSION_ID: input.sessionId, ...(projectId ? { PSTDIO_PROJECT_ID: projectId } : {}) },
});
