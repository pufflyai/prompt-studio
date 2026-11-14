import type { SessionEventSink } from "../sessions/session-stream-connections";
import type { WorkspacesRouteDeps } from "./deps";
import { observeWorkspaceChanges } from "./workspace-observation";

export const streamWorkspaceChanges = async (
  deps: Pick<WorkspacesRouteDeps, "workspaceService" | "eventBus">,
  input: { project_id: string; workspace_id: string },
  sink: SessionEventSink,
  kind: "diff" | "files",
) => {
  const stopped = Promise.withResolvers<void>();
  let stop: (() => void) | undefined;
  let dirty = false;
  let writing = false;
  let ready = false;
  let ended = false;
  const end = () => {
    ended = true;
    stop?.();
    stopped.resolve();
  };
  sink.onAbort(end);
  const pump = () => {
    dirty = true;
    if (writing || !ready || ended || sink.aborted) return;
    writing = true;
    void (async () => {
      while (dirty && !ended && !sink.aborted) {
        dirty = false;
        await sink.write(`${kind}_changed`, { workspace_id: input.workspace_id });
      }
    })()
      .catch(end)
      .finally(() => {
        writing = false;
        if (dirty && !ended && !sink.aborted) pump();
      });
  };
  const observation = await observeWorkspaceChanges(
    deps,
    input,
    (event) => {
      if (event === "changed") pump();
      else {
        void sink.write("end", {}).catch(() => {});
        end();
      }
    },
    kind,
  );
  stop = observation.close;
  if (ended || sink.aborted) return end();
  // Do not wait for socket backpressure to release a cancelled OS observation.
  void sink.write(`${kind}_ready`, { workspace_id: input.workspace_id }).then(() => {
    ready = true;
    if (dirty) pump();
  }, end);
  await stopped.promise;
  stop();
};
