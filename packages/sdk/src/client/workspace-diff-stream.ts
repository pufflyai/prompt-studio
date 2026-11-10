import type { createSessionStreamTransport } from "./session-stream";

export interface WorkspaceDiffWatchInput {
  projectId: string;
  signal: AbortSignal;
  onReady(): void;
  onChange(): void;
}

/** Logical diff observation on the client's existing shared transport. */
export const watchWorkspaceDiff = (
  transport: ReturnType<typeof createSessionStreamTransport>,
  workspaceId: string,
  input: WorkspaceDiffWatchInput,
) =>
  new Promise<void>((resolve, reject) => {
    if (input.signal.aborted) return resolve();
    let subscription: { close(): void } | undefined;
    let settled = false;
    const finish = (failure?: { error: unknown }) => {
      if (settled) return;
      settled = true;
      input.signal.removeEventListener("abort", aborted);
      subscription?.close();
      if (failure) reject(failure.error);
      else resolve();
    };
    const aborted = () => finish();
    input.signal.addEventListener("abort", aborted, { once: true });
    subscription = transport.subscribe(
      { workspace_diff: { project_id: input.projectId, workspace_id: workspaceId } },
      {
        onEvent(event) {
          if (settled || input.signal.aborted) return;
          try {
            if (event === "end") finish();
            else if (event === "diff_ready") input.onReady();
            else if (event === "diff_changed") input.onChange();
          } catch (error) {
            finish({ error });
          }
        },
        onError: (error) => finish({ error }),
      },
    );
    if (settled) subscription.close();
  });
