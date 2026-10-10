import { existsSync } from "node:fs";
import { type RuntimeArtifactMount, resolveArtifactMountRoot } from "pstdio-extensions";
import { apiLogger } from "../../../lib/logger";
import { resolveWorkspaceFilesPath } from "../command-environment/workspace-files";
import type { ExtensionsRouteDeps } from "../deps";
import { fireExtensionEvent } from "../extension-event-runtime";
import { watchArtifactMount } from "./mount-watcher";

type WatchTarget = { projectId: string; mount: RuntimeArtifactMount; root: string };

// These tables decide which mounts are watched and where their folders are. Only default
// workspaces hold mount copies, so other workspace updates, such as worktree status, are skipped.
// A deleted workspace row carries only its id.
const watchSetTables = new Set(["extension_instances", "installed_extension_sources", "projects"]);
const changesWatchSet = (event: { table: string; op: string; data: unknown }) =>
  event.table === "workspaces"
    ? event.op === "delete" || (event.data as { is_default?: unknown } | null)?.is_default === true
    : watchSetTables.has(event.table);

/**
 * Watches every `watch: true` artifact mount of every enabled extension, in the copy that mount
 * calls read and write: the project's ready local default workspace. The watch set is derived
 * from the runtime snapshots and default workspaces, never stored.
 */
export const createArtifactMountWatchService = (input: {
  deps: ExtensionsRouteDeps;
  listProjectIds: () => Promise<string[]>;
}) => {
  const { deps } = input;
  const watches = new Map<string, { close: () => void }>();
  const deliveries = new Set<Promise<unknown>>();
  let disposed = false;
  let running: Promise<void> | null = null;
  let queued = false;

  const listTargets = async () => {
    const targets = new Map<string, WatchTarget>();
    for (const projectId of await input.listProjectIds()) {
      // The same rule as mount reads: remote, unready, rootless, and file-less workspaces have no copy.
      // A workspace folder that is gone is not created again just to watch it.
      const repoRoot = await resolveWorkspaceFilesPath(deps, { projectId }, "read").catch(() => null);
      if (!repoRoot || !existsSync(repoRoot)) continue;
      let mounts: RuntimeArtifactMount[];
      try {
        mounts = (await deps.extensionRuntimeCatalog.get(projectId)).runtime.artifactMounts;
      } catch (err) {
        apiLogger.error(
          { err, event: "extensions.artifact_watch.project_load_error", project_id: projectId },
          "Failed to load project extensions for artifact mount watches",
        );
        continue;
      }
      for (const mount of mounts) {
        if (!mount.watch) continue;
        const root = resolveArtifactMountRoot({ repoRoot, name: mount.name, mountPath: mount.relativePath });
        targets.set(JSON.stringify([projectId, mount.id, root]), { projectId, mount, root });
      }
    }
    return targets;
  };

  const deliver = (projectId: string, mount: RuntimeArtifactMount, paths: string[]) => {
    const delivery = fireExtensionEvent(deps, projectId, mount.changedEventId, { mount: mount.localId, paths })
      .catch((err) =>
        apiLogger.warn(
          { err, event: "extension.event.dispatch_failed", event_id: mount.changedEventId, project_id: projectId },
          "Extension event dispatch failed",
        ),
      )
      .finally(() => deliveries.delete(delivery));
    deliveries.add(delivery);
  };

  const openWatch = ({ projectId, mount, root }: WatchTarget) => {
    const logFields = { mount_id: mount.id, project_id: projectId };
    return watchArtifactMount({
      root,
      ledger: deps.artifactMountWrites,
      onChange: (paths) => deliver(projectId, mount, paths),
      onError: (err) =>
        apiLogger.error({ err, event: "extensions.artifact_watch.error", ...logFields }, "Artifact mount watch failed"),
      onFolderLimit: () =>
        apiLogger.warn(
          { event: "extensions.artifact_watch.folder_limit", ...logFields },
          "Artifact mount has too many folders to watch each one; its change events ask for a full reload",
        ),
    });
  };

  const reconcile = async () => {
    const targets = await listTargets();
    if (disposed) return;

    for (const [key, watch] of watches) {
      if (targets.has(key)) continue;
      watch.close();
      watches.delete(key);
    }
    for (const [key, target] of targets) {
      if (watches.has(key)) continue;
      try {
        watches.set(key, openWatch(target));
      } catch (err) {
        // Not stored, so the next reconcile tries again.
        apiLogger.error(
          { err, event: "extensions.artifact_watch.error", mount_id: target.mount.id, project_id: target.projectId },
          "Artifact mount watch failed to start",
        );
      }
    }
  };

  // One reconcile runs at a time. Changes during a run queue exactly one more.
  const refresh = () => {
    if (running) {
      queued = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          queued = false;
          await reconcile().catch((err) =>
            apiLogger.error({ err, event: "extensions.artifact_watch.reconcile_error" }, "Artifact mount watch failed"),
          );
        } while (queued && !disposed);
      } finally {
        running = null;
      }
    })();
    return running;
  };

  const unsubscribe = deps.eventBus.subscribe((event) => {
    if (changesWatchSet(event)) void refresh();
  });
  void refresh();

  return {
    refresh,
    dispose: async () => {
      disposed = true;
      unsubscribe();
      for (const watch of watches.values()) watch.close();
      watches.clear();
      // Reconciles and hooks still reading data must finish before the host closes the database.
      await Promise.all([running, ...deliveries]);
    },
  };
};
