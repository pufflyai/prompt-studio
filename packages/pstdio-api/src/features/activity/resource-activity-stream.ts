import { type ResourceRef, resourceKey } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import type { SessionEventSink } from "../sessions/session-stream-connections";
import { resourceActivityAccess } from "./resource-activity-access";
import { activityStorageOwner } from "./resource-activity-store";

/** Activity observations are logical subscriptions; storage changes include remote-device commits. */
export const streamResourceActivity = async (
  deps: ExtensionsRouteDeps,
  input: { project_id: string; resource: ResourceRef },
  sink: SessionEventSink,
) => {
  const access = await resourceActivityAccess(deps, { projectId: input.project_id }, input.resource, "read");
  if (!access) throw new Error("Activity is not enabled on this resource.");
  if (sink.aborted) return;
  const stopped = Promise.withResolvers<void>();
  const owner = activityStorageOwner(input.project_id);
  let pending = false;
  let ended = false;
  let unscoped = false;
  const ids = new Set<string>();
  const records = (await deps.extensionStorageService.open({ owner })).records;
  let writing = false;
  let ready = false;
  const stop = deps.extensionStorageService.watch((changed) => {
    if (ended || changed.workbenchId !== owner.workbenchId || changed.extensionId !== owner.extensionId) return;
    if (!changed.recordIds) unscoped = true;
    for (const id of changed.recordIds ?? []) if (id.startsWith("entry/")) ids.add(id);
    if (unscoped || ids.size) pump();
  });
  const end = () => {
    ended = true;
    stop();
    stopped.resolve();
  };
  const pump = () => {
    pending = true;
    if (writing || !ready || sink.aborted || ended) return;
    writing = true;
    void (async () => {
      while (pending && !sink.aborted && !ended) {
        pending = false;
        let relevant = unscoped;
        unscoped = false;
        const changedIds = [...ids];
        ids.clear();
        for (let offset = 0; offset < changedIds.length; offset += 100) {
          const rows = await records.readMany(changedIds.slice(offset, offset + 100));
          relevant ||= rows.some((row) => (row.value as { scope?: string })?.scope === resourceKey(access.resource));
        }
        if (!relevant || ended) continue;
        if (!(await resourceActivityAccess(deps, { projectId: input.project_id }, input.resource, "read")))
          throw new Error("Activity is no longer available.");
        await sink.write("activity_changed", { resource: access.resource });
      }
    })()
      .catch(async (error: unknown) => {
        void sink.write("error", { message: error instanceof Error ? error.message : String(error) }).catch(() => {});
        end();
      })
      .finally(() => {
        writing = false;
        if (pending && !sink.aborted && !ended) pump();
      });
  };
  sink.onAbort(end);
  if (sink.aborted) return end();
  void sink.write("activity_ready", { resource: access.resource }).then(() => {
    ready = true;
    if (pending) pump();
  }, end);
  await stopped.promise;
};
