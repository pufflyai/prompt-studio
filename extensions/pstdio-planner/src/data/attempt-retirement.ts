import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { readWorkspaceEvents } from "./attempt-queries";
import { attemptEventsCollection } from "./attempt-storage";
import type { AttemptTimelineEvent } from "./attempt-types";

export const retiredWorkspaceIds = (events: AttemptTimelineEvent[]) =>
  new Set(events.filter((event) => event.type === "attempt_abandoned").map((event) => event.workspaceId));

export const readRetiredWorkspaceIds = async (storage: ExtensionStorageApi, workspaceIds?: string[]) =>
  retiredWorkspaceIds(
    workspaceIds
      ? await readWorkspaceEvents(storage, workspaceIds, "attempt_abandoned")
      : await attemptEventsCollection(storage).list(),
  );
