import type { WorkspacesRouteDeps } from "./deps";
import { watchWorkspaceDiffFiles } from "./workspace-diff-filesystem";
import { watchWorkspaceFiles } from "./workspace-files-observation";
import { resolveWorkspaceExecutionTarget } from "./workspace-provider-execution-target";
import { workspaceGitPaths } from "./worktree-cleanup";

type Deps = Pick<WorkspacesRouteDeps, "workspaceService" | "eventBus">;
type Watch = Awaited<ReturnType<typeof watchWorkspaceDiffFiles>>;
interface Observation {
  listeners: Set<(event: "changed" | "closed") => void>;
  ready: Promise<Watch>;
  close(): void;
}
const owners = new WeakMap<Deps["workspaceService"], Map<string, Observation>>();

export const observeWorkspaceChanges = async (
  deps: Deps,
  input: { project_id: string; workspace_id: string },
  changed: (event: "changed" | "closed") => void,
  kind: "files" | "diff",
) => {
  const target = await resolveWorkspaceExecutionTarget(
    deps,
    input.workspace_id,
    kind === "diff" ? "diff" : "files:read",
  );
  if (!target || target.workspace.project_id !== input.project_id)
    throw new Error(`Workspace ${kind} is not available.`);
  let entries = owners.get(deps.workspaceService);
  if (!entries) {
    entries = new Map();
    owners.set(deps.workspaceService, entries);
  }
  const key = JSON.stringify([input.project_id, input.workspace_id, target.root, kind]);
  let entry = entries.get(key);
  if (!entry) {
    const listeners = new Set<(event: "changed" | "closed") => void>();
    const watch = kind === "diff" ? watchWorkspaceDiffFiles : watchWorkspaceFiles;
    const ready = watch(target.root, () => {
      for (const notify of listeners) notify("changed");
    });
    const stopRows = deps.eventBus.subscribe((event) => {
      if (event.table !== "workspaces" || (event.data as { id?: string }).id !== input.workspace_id) return;
      const row = event.data as typeof target.workspace;
      const root = kind === "diff" ? (workspaceGitPaths(row)?.worktreeRoot ?? row.root_path) : row.root_path;
      if (
        event.op === "delete" ||
        row.project_id !== input.project_id ||
        root !== target.root ||
        row.execution_kind !== "local" ||
        row.provider_state !== "ready" ||
        row.initializing ||
        row.setup_error ||
        (kind === "diff"
          ? row.provider_capabilities_json?.diff !== true
          : row.provider_capabilities_json?.files === "none")
      )
        for (const notify of listeners) notify("closed");
    });
    let closed = false;
    entry = {
      listeners,
      ready,
      close() {
        if (closed) return;
        closed = true;
        entries.delete(key);
        stopRows();
        void ready.then(
          (watch) => watch.close(),
          () => {},
        );
      },
    };
    entries.set(key, entry);
  }
  const held = entry;
  const token = (event: "changed" | "closed") => changed(event);
  held.listeners.add(token);
  const close = () => {
    held.listeners.delete(token);
    if (!held.listeners.size) held.close();
  };
  try {
    await held.ready;
    return { identity: held, close };
  } catch (error) {
    close();
    throw error;
  }
};
