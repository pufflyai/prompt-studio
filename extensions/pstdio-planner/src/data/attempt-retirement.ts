import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { AttemptTimelineEvent } from "./attempt-types";
import { preparePlannerIndexes } from "./storage-indexes";

export const retiredWorkspaceIds = (events: AttemptTimelineEvent[]) =>
  new Set(
    events.filter((event) => event.type === "attempt_abandoned").map((event) => event.attemptId ?? event.workspaceId),
  );

export const readRetiredWorkspaceIds = async (storage: ExtensionStorageApi, attemptIds: string[]) => {
  await preparePlannerIndexes(storage);
  const retired = new Set<string>();
  for (let offset = 0; offset < attemptIds.length; offset += 100) {
    for (const field of ["attemptId", "workspaceId"]) {
      const result = await storage.records.aggregate({
        index: "attempt-events-workspace",
        where: {
          all: [
            { field, op: "in", value: attemptIds.slice(offset, offset + 100) },
            { field: "type", op: "eq", value: "attempt_abandoned" },
            ...(field === "workspaceId"
              ? [
                  {
                    any: [
                      { field: "attemptId", op: "missing" as const },
                      { field: "attemptId", op: "eq" as const, value: null },
                    ],
                  },
                ]
              : []),
          ],
        },
        groupBy: field,
        groupLimit: 100,
      });
      for (const group of result.groups) retired.add(String(group.value));
    }
  }
  return retired;
};
