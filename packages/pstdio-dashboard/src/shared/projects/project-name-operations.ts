import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import type { SyncedRow } from "@/lib/sync/collections";
import { createRuntimeState } from "@/lib/sync/runtime-state";

const domain = "project.rename";
const subject = (id: string) => operationSubject("local-project", id);

export const getProjectNameOperations = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  const operations = getWorkbenchOperations(queries);
  const api = getRuntimeApiClient(owner).projects;
  const readRow = (id: string) => owner.getCollection("projects").state.get(id);
  const authority = () => {
    const { runtimeId, accountId, accountOrigin } = queries.getScope();
    return JSON.stringify([runtimeId, accountId, accountOrigin]);
  };
  const pending = (id: string | undefined) =>
    id
      ? operations.getSnapshot().pending.find((entry) => entry.domain === domain && entry.projectId === id)
      : undefined;
  const name = (id: string | undefined, confirmed: string) => {
    const intent = pending(id)?.intent;
    return typeof intent === "string" ? intent : confirmed;
  };
  return {
    name,
    pending,
    authority,
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    project<T extends SyncedRow>(row: T): T {
      if (typeof row.name !== "string") return row;
      const label = name(row.id, row.name);
      return label === row.name ? row : { ...row, name: label };
    },
    async rename(id: string | undefined, label: string, expectedAuthority: string) {
      if (!id || expectedAuthority !== authority()) throw new Error("The original project is no longer active.");
      if (!label.trim()) throw new Error("Enter a project name.");
      const name = label.trim();
      if (operations.getSnapshot().pending.some((entry) => entry.subjects.includes(subject(id))))
        throw new Error("This project has an unfinished change. Check System activity.");
      const readName = async (signal: AbortSignal) => {
        const before = readRow(id);
        const confirmed = await api.get(id, { signal });
        return { before, name: confirmed.name };
      };
      return operations.submit<Awaited<ReturnType<typeof readName>> | undefined>({
        projectId: id,
        domain,
        subjects: [subject(id)],
        title: "Rename project",
        sourceCommand: { id: WORKBENCH_SETTINGS_OPEN_COMMAND_ID, args: { panelId: "project-folder" } },
        intent: name,
        draft: { name },
        classify: classifyApiWrite,
        async write(signal) {
          await api.update(id, { name }, { signal });
          return undefined;
        },
        async reconcile(verified, signal) {
          const confirmed = verified ?? (await readName(signal));
          signal.throwIfAborted();
          const row = readRow(id);
          if (
            row &&
            confirmed.before &&
            row.name === confirmed.before.name &&
            row.created_at === confirmed.before.created_at
          )
            owner.getWriter("projects")?.upsert({ ...row, name: confirmed.name });
        },
        async check(signal) {
          const confirmed = await readName(signal);
          return confirmed.name === name ? { status: "confirmed", result: confirmed } : { status: "unknown" };
        },
      }).result;
    },
  };
});

export const useProjectNameOperations = () => {
  const names = getProjectNameOperations();
  useSyncExternalStore(names.subscribe, names.snapshot, names.snapshot);
  return names;
};
