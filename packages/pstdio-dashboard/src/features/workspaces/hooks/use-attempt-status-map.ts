import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/features/sync/collections";
import { buildAttemptStatusMap } from "./attempt-status-map";

export { buildAttemptStatusMap } from "./attempt-status-map";

export const useAttemptStatusMap = (projectId: string | undefined) => {
  const { data: rawData } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ s: getCollection("attempt_statuses") })
            .where(({ s }) => eq(s.project_id, projectId))
            .select(({ s }) => ({ ...s }))
        : undefined,
    [projectId],
  );
  return buildAttemptStatusMap(asSyncedRows(rawData));
};
