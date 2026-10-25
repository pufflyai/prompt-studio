import { and, eq } from "drizzle-orm";
import type { PsxDatabase } from "./database";
import { extensionReleases } from "./schema";

export const objectKey = (release: { extensionId: string; version: string; sha256: string }) =>
  `${release.extensionId}/${release.version}/${release.sha256}.tgz`;
export const getRelease = async (database: PsxDatabase, id: string, version: string) => {
  const [release] = await database
    .select()
    .from(extensionReleases)
    .where(and(eq(extensionReleases.extensionId, id), eq(extensionReleases.version, version)));
  return release;
};
