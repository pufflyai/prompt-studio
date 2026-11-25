import { isDeepStrictEqual } from "node:util";
import { sql } from "drizzle-orm";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { resource_links } from "./schemas.pg";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type ReleasedLink = Omit<typeof resource_links.$inferSelect, "source_owner" | "target_owner"> & {
  project_id: string;
  source_owner: string;
  target_owner: string;
};

/** Preserve both endpoints and saved presentation before replacing the released table. */
export const prepareResourceLinkOwnerUpgrade = async (db: DbClient, path: string) => {
  const pending: ReleasedLink[] = [];
  let pendingBytes = 0;
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    pendingBytes = 0;
    await db.transaction(async (tx) => {
      const ids = new Map<string, number>();
      const ownerId = async (project: string, extension: string) => {
        const key = JSON.stringify([project, extension]);
        let id = ids.get(key);
        if (id === undefined) {
          id = await ensureStorageOwner(tx, { workbenchId: project, extensionId: extension });
          ids.set(key, id);
        }
        return id;
      };
      const expected = [];
      for (const { project_id, source_owner, target_owner, ...fields } of batch)
        expected.push({
          ...fields,
          source_owner: await ownerId(project_id, source_owner),
          target_owner: await ownerId(project_id, target_owner),
        });
      const keys = ["source_owner", "source_kind", "source_id", "target_owner", "target_kind", "target_id"] as const;
      const key = (row: typeof resource_links.$inferSelect) => JSON.stringify(keys.map((column) => row[column]));
      const existing = await tx
        .select()
        .from(resource_links)
        .where(sql`(
        ${sql.join(
          keys.map((column) => resource_links[column]),
          sql`, `,
        )}
      ) IN (${sql.join(
        expected.map(
          (row) =>
            sql`(${sql.join(
              keys.map((column) => sql`${row[column]}`),
              sql`, `,
            )})`,
        ),
        sql`, `,
      )})`);
      const retained = new Map(existing.map((row) => [key(row), row]));
      const missing = [];
      for (const row of expected) {
        const previous = retained.get(key(row));
        if (!previous) missing.push(row);
        else if (!isDeepStrictEqual(previous, row)) throw new Error("Resource link restoration conflict");
      }
      if (missing.length) await tx.insert(resource_links).values(missing);
    });
  };
  const restore = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "resource_anchors",
      keys: ["project_id", "source_owner", "source_kind", "source_id", "target_owner", "target_kind", "target_id"],
      name: "resource-link-owners",
      archive: "resource-links",
    },
    async (input) => {
      const bytes = Buffer.byteLength(JSON.stringify(input));
      if (pending.length && pendingBytes + bytes > 4 * 1024 * 1024) await flush();
      pending.push(input as ReleasedLink);
      pendingBytes += bytes;
      if (pending.length === 200) await flush();
    },
  );
  if (!restore) return;
  return async () => {
    await restore(true);
    await flush();
    await restore.complete();
  };
};
