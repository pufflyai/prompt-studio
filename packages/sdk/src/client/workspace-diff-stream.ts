import type { createSessionStreamTransport } from "./session-stream";

export interface WorkspaceDiffWatchInput {
  projectId: string;
  signal: AbortSignal;
  onReady(): void;
  onChange(): void;
}

/** Logical diff observation on the client's existing shared transport. */
const watchWorkspaceChanges = (
  transport: ReturnType<typeof createSessionStreamTransport>,
  workspaceId: string,
  input: WorkspaceDiffWatchInput,
  kind: "diff" | "files",
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
      kind === "diff"
        ? { workspace_diff: { project_id: input.projectId, workspace_id: workspaceId } }
        : { workspace_files: { project_id: input.projectId, workspace_id: workspaceId } },
      {
        onEvent(event) {
          if (settled || input.signal.aborted) return;
          try {
            if (event === "end") finish();
            else if (event === `${kind}_ready`) input.onReady();
            else if (event === `${kind}_changed`) input.onChange();
          } catch (error) {
            finish({ error });
          }
        },
        onError: (error) => finish({ error }),
      },
    );
    if (settled) subscription.close();
  });

export const watchWorkspaceDiff = (
  transport: ReturnType<typeof createSessionStreamTransport>,
  workspaceId: string,
  input: WorkspaceDiffWatchInput,
) => watchWorkspaceChanges(transport, workspaceId, input, "diff");

export const watchWorkspaceFiles = (
  transport: ReturnType<typeof createSessionStreamTransport>,
  workspaceId: string,
  input: WorkspaceDiffWatchInput,
) => watchWorkspaceChanges(transport, workspaceId, input, "files");
