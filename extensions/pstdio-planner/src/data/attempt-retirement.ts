import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { attemptEventsCollection } from "./attempt-storage";
import type { AttemptTimelineEvent } from "./attempt-types";

export const retiredWorkspaceIds = (events: AttemptTimelineEvent[]) =>
  new Set(events.filter((event) => event.type === "attempt_abandoned").map((event) => event.workspaceId));

export const readRetiredWorkspaceIds = async (storage: ExtensionStorageApi) =>
  retiredWorkspaceIds(await attemptEventsCollection(storage).list());
