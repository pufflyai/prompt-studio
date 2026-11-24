import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";

export type ProjectFolderChoice = { path: string } & ({ mode: "attach" } | { mode: "choose"; clone: boolean });
const assignSubject = (id: string) => operationSubject("project-folder", id);

export const getProjectFolderAssignments = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  const operations = getWorkbenchOperations(queries);
  const client = getDashboardQueryClient(owner);
  const api = getRuntimeApiClient(owner).projects;
  const authority = () => {
    const { runtimeId, accountId, accountOrigin } = queries.getScope();
    return JSON.stringify([runtimeId, accountOrigin, accountId]);
  };
  const pending = (id: string | undefined) => {
    const snapshot = operations.getSnapshot();
    const active = id && snapshot.pending.find((entry) => entry.subjects.includes(assignSubject(id)));
    const recovery = active ? snapshot.recovery.find((entry) => entry.id === active.id) : undefined;
    return { busy: Boolean(active), working: Boolean(active && !recovery), error: recovery?.error };
  };
  return {
    pending,
    authority,
    subscribe: operations.subscribe,
    snapshot: operations.getSnapshot,
    async assign(id: string | undefined, choice: ProjectFolderChoice, expected: string) {
      if (!id || expected !== authority()) throw new Error("The original project is no longer active.");
      if (pending(id).busy) throw new Error("This project has an unfinished folder change. Check System activity.");
      return operations.submit<void>({
        projectId: id,
        domain: "project.folder-assignment",
        subjects: [assignSubject(id)],
        title: "Attach project folder",
        sourceCommand:
          choice.mode === "attach"
            ? { id: WORKBENCH_SETTINGS_OPEN_COMMAND_ID, args: { panelId: "project-folder" } }
            : { id: dashboardCommandIds.chooseProjectFolder },
        draft: choice,
        classify: classifyApiWrite,
        async write(signal) {
          signal.throwIfAborted();
          if (choice.mode === "attach")
            await api.attachInitialWorkspace(id, { provider_id: "pstdio.root", params: { path: choice.path } });
          else await api.chooseFolder(id, { path: choice.path, clone: choice.clone });
        },
        async reconcile(_result, signal) {
          signal.throwIfAborted();
          await Promise.all(
            ["project-folder", "project-workspaces"].map((name) => client.invalidateQueries({ queryKey: [name, id] })),
          );
        },
        async check(signal) {
          signal.throwIfAborted();
          const confirmed = await api.folder(id);
          // A shortened or noncanonical path does not prove which folder was attached.
          return confirmed.path === choice.path ? { status: "confirmed", result: undefined } : { status: "unknown" };
        },
      }).result;
    },
  };
});

export const useProjectFolderAssignment = (projectId?: string) => {
  const assignments = getProjectFolderAssignments();
  useSyncExternalStore(assignments.subscribe, assignments.snapshot, assignments.snapshot);
  const expected = assignments.authority();
  return {
    ...assignments.pending(projectId),
    assign: (choice: ProjectFolderChoice) => assignments.assign(projectId, choice, expected),
  };
};
