import { spaceKeysPath, spaceKeysSchema } from "pstdio-sync-contracts";
import { createSyncSpace } from "../encryption";
import { serviceUrl } from "./http";

/**
 * Reads the project key and this user's personal-space key from the account manager. The keys stay
 * on the device; the relay only ever sees what they seal.
 */
export const fetchSyncSpaces = async (input: {
  managerOrigin: string;
  /** The device credential from Google login. */
  credential: string;
  accountId: string;
  workbenchId: string;
  signal?: AbortSignal;
}) => {
  const response = await fetch(serviceUrl(input.managerOrigin, spaceKeysPath(input.workbenchId)), {
    signal: input.signal,
    headers: { authorization: `Bearer ${input.credential}` },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Sync keys unavailable (${response.status})`);
  }
  const keys = spaceKeysSchema.parse(await response.json());
  const [project, personal] = await Promise.all([
    createSyncSpace({ projectId: input.workbenchId, spaceOwner: null, keys: keys.project }),
    createSyncSpace({ projectId: input.workbenchId, spaceOwner: input.accountId, keys: keys.personal }),
  ]);
  return { project, personal };
};
