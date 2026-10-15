import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAssetBytesStorage } from "pstdio-storage";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createGroupedStorageDBService } from "./grouped-storage";

export const groupedStorageOwner = { workbenchId: "workbench-a", extensionId: "example.notes" };

export const openGroupedTestStorage = async (cleanup: (() => Promise<unknown>)[], path = ":memory:", seed = true) => {
  const owner = groupedStorageOwner;
  const assetRoot = await mkdtemp(join(tmpdir(), "grouped-assets-"));
  cleanup.push(() => rm(assetRoot, { recursive: true, force: true }));
  const assets = createAssetBytesStorage(assetRoot);
  const database = await createDb({ path });
  cleanup.push(database.close);
  if (seed) {
    const timestamp = new Date().toISOString();
    await database.db
      .insert(projects)
      .values({ id: owner.workbenchId, name: "Notes", shorthand: "N", created_at: timestamp, updated_at: timestamp });
  }
  const service = createGroupedStorageDBService(database.db);
  return {
    ...database,
    assets,
    records: service.open({
      owner,
      environmentId: "environment-a",
      assets: {
        verifyComplete: async (references) => {
          for (const reference of references) await assets.verify(owner, reference);
        },
        read: (asset) => assets.open(owner, asset),
        receive: async (asset, source) => {
          const operationId = `receive:${asset.sha256}`;
          const offset = await assets.progress(owner, operationId);
          await assets.append(owner, operationId, offset, await source(offset, new AbortController().signal));
          await assets.publish(owner, operationId, asset);
        },
      },
    }).records,
  };
};
