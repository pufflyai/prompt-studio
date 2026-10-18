import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { attemptEventsCollection } from "./attempt-storage";

export const readRetiredWorkspaceIds = async (storage: ExtensionStorageApi) =>
  new Set(
    (await attemptEventsCollection(storage).list())
      .filter((event) => event.type === "attempt_abandoned")
      .map((event) => event.workspaceId),
  );
