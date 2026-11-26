import { join } from "node:path";

export type ReviewRecord = {
  id: string;
  projectId: string;
  instanceId: string;
  sourcePath: string;
  sourceRef: string | null;
  separateProviderId?: string;
  workingFingerprint: string;
  incomingRef: string | null;
  incomingVersion: string;
  expectedIdentity: string;
  based: boolean;
  createdAt: string;
};

export const reviewDirectory = (home: string, id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid extension upgrade review ID.");
  return join(home, "extension-upgrade-reviews", id);
};

export const readExtensionReviewRecord = async (home: string, id: string) => {
  const directory = reviewDirectory(home, id);
  try {
    const record = (await Bun.file(join(directory, "review.json")).json()) as ReviewRecord;
    return record.id === id ? { directory, record } : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
