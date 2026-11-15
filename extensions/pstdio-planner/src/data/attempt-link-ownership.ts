import type { ExtensionStorageApi, StoragePredicate } from "@pstdio/sdk/extensions";
import { upgradeAttemptStorage } from "./attempt-upgrade";
import { preparePlannerIndexes } from "./storage-indexes";

/** Link protection needs existence, never the ticket's complete attempt histories. */
export const isManagedAttemptLink = async (
  storage: ExtensionStorageApi,
  ticketId: string,
  target: { workspaceId: string } | { sessionId: string },
) => {
  await upgradeAttemptStorage(storage);
  await preparePlannerIndexes(storage);
  const owner: StoragePredicate =
    "workspaceId" in target
      ? { field: "workspaceId", op: "eq", value: target.workspaceId }
      : {
          any: [
            { field: "implementationSessionId", op: "eq", value: target.sessionId },
            { field: "reviewSessions", op: "contains", value: target.sessionId },
          ],
        };
  const result = await storage.records.query({
    index: "attempt-ticket",
    where: { all: [{ field: "ticketId", op: "eq", value: ticketId }, owner] },
    fields: [],
    limit: 1,
  });
  return result.records.length > 0;
};
