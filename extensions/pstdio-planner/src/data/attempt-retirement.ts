import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { AttemptTimelineEvent } from "./attempt-types";
import { preparePlannerIndexes } from "./storage-indexes";

export const retiredWorkspaceIds = (events: AttemptTimelineEvent[]) =>
  new Set(events.filter((event) => event.type === "attempt_abandoned").map((event) => event.workspaceId));

export const readRetiredWorkspaceIds = async (storage: ExtensionStorageApi, workspaceIds: string[]) => {
  await preparePlannerIndexes(storage);
  const retired = new Set<string>();
  for (let offset = 0; offset < workspaceIds.length; offset += 100) {
    const result = await storage.records.aggregate({
      index: "attempt-events-workspace",
      where: {
        all: [
          { field: "workspaceId", op: "in", value: workspaceIds.slice(offset, offset + 100) },
          { field: "type", op: "eq", value: "attempt_abandoned" },
        ],
      },
      groupBy: "workspaceId",
      groupLimit: 100,
    });
    for (const group of result.groups) retired.add(String(group.value));
  }
  return retired;
};
