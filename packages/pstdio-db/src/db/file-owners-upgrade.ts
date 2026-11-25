import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { eq, sql } from "drizzle-orm";
import { encodeFileScope } from "../services/extension-files/extension-files";
import { fileColumns } from "../services/files/files";
import type { DbClient } from "./connection.pglite";
import { cleanFileOwnerStaging, copyFileOwnerBytes, fileOwnerUuid } from "./file-owner-copies";
import { createFileOwnerExportWriter } from "./file-owner-exports";
import { files, skills } from "./schemas.pg";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type Metadata = Omit<typeof files.$inferSelect, "owner" | "scope" | "path">;
type Identity = { owner: string; scope: string | null; path: string | null };
type Input = {
  kind: "skill" | "extension";
  key: string;
  released: Record<string, unknown>;
  file: Metadata;
  identity: Identity;
};
const normalized = async (db: DbClient, kind: Input["kind"], released: Record<string, unknown>) => {
  const [file] = await db
    .select(fileColumns)
    .from(files)
    .where(eq(files.id, released.file_id as string));
  if (!file || file.project_id !== released.project_id) throw new Error("File binding does not belong to project.");
  let identity: Identity;
  if (kind === "skill") {
    const [skill] = await db
      .select({ project: skills.project_id })
      .from(skills)
      .where(eq(skills.id, released.skill_id as string));
    if (skill?.project !== file.project_id) throw new Error("Skill file does not belong to project.");
    identity = { owner: `skill:${released.skill_id}`, scope: null, path: released.path as string };
  } else {
    const {
      rows: [owner],
    } = await db.execute<{ extension_id: string }>(sql`
      SELECT s.extension_id FROM extension_instances i JOIN installed_extension_sources s ON s.id = i.installed_extension_id
      WHERE i.id = ${released.extension_instance_id} AND i.scope_type = 'project' AND i.scope_id = ${file.project_id}
    `);
    if (!owner) throw new Error("Extension file does not belong to project.");
    identity = {
      owner: owner.extension_id,
      path: null,
      scope: encodeFileScope({
        scope_type: released.scope_type as string,
        scope_id: released.scope_id as string | null,
      }),
    };
  }
  const key = JSON.stringify(kind === "skill" ? [kind, released.skill_id, released.path] : [kind, released.id]);
  return { kind, key, released, file, identity };
};
const baseMetadata = (row: typeof files.$inferSelect) => {
  const { owner, scope, path, ...value } = row;
  return value;
};
const sameIdentity = (row: typeof files.$inferSelect, expected: Identity) =>
  row.owner === expected.owner && row.scope === expected.scope && row.path === expected.path;
const restore = async (tx: Pick<DbClient, "select" | "update" | "insert">, database: string, input: Input) => {
  const [original] = await tx.select().from(files).where(eq(files.id, input.file.id)).for("update");
  if (!original || !isDeepStrictEqual(baseMetadata(original), input.file))
    throw new Error(`Original file metadata changed: ${input.file.id}`);
  if (sameIdentity(original, input.identity)) return { file_id: original.id, storage_path: original.storage_path };
  if (original.owner === null && original.file_kind === input.kind) {
    await tx.update(files).set(input.identity).where(eq(files.id, original.id));
    return { file_id: original.id, storage_path: original.storage_path };
  }
  const id = fileOwnerUuid(
    JSON.stringify([
      input.file.id,
      input.file.project_id,
      input.identity.owner,
      input.identity.scope,
      input.identity.path,
    ]),
  );
  const storage_path = join(`${database}-owned-files`, id);
  const [existing] = await tx.select().from(files).where(eq(files.id, id));
  const metadata = { ...input.file, id, storage_path };
  if (existing && (!sameIdentity(existing, input.identity) || !isDeepStrictEqual(baseMetadata(existing), metadata)))
    throw new Error(`File migration UUID collision: ${id}`);
  await copyFileOwnerBytes(database, id, input.file, input.identity);
  if (!existing) await tx.insert(files).values({ ...metadata, ...input.identity });
  return { file_id: id, storage_path };
};
export const prepareFileOwnersUpgrade = async (db: DbClient, path: string) => {
  await cleanFileOwnerStaging(path);
  let writer: Awaited<ReturnType<typeof createFileOwnerExportWriter>> | undefined;
  const snapshots: Array<{ restore: () => Promise<void>; complete: () => Promise<void> }> = [];
  for (const kind of ["skill", "extension"] as const) {
    const staged: Input[] = [];
    let stagedBytes = 0;
    const flush = async () => {
      if (!staged.length) return;
      const batch = staged.splice(0);
      stagedBytes = 0;
      const mappings = await db.transaction(async (tx) => {
        const mappings = [];
        for (const input of batch) mappings.push({ ...input, converted: await restore(tx, path, input) });
        return mappings;
      });
      if (path === ":memory:") return;
      writer ??= await createFileOwnerExportWriter(path, "mappings");
      for (let start = 0; start < mappings.length; start += 8) {
        const results = await Promise.allSettled(
          mappings.slice(start, start + 8).map((mapping) => writer!.write(mapping.key, mapping)),
        );
        const failed = results.find((result) => result.status === "rejected");
        if (failed) throw failed.reason;
      }
      // Original inputs remain durable until every mapping has been published and synced.
      // A crash before this flush replays the committed batch from those inputs.
      await writer.flush();
    };
    const snapshot = await prepareUpgradeSnapshot(
      db,
      path,
      {
        table: `${kind}_files`,
        keys: kind === "skill" ? ["skill_id", "path"] : ["id"],
        name: `${kind}-files`,
        archive: `${kind}-files`,
      },
      async (row) => {
        const bytes = Buffer.byteLength(JSON.stringify(row));
        if (staged.length && stagedBytes + bytes > 4 * 1024 * 1024) await flush();
        staged.push(row as unknown as Input);
        stagedBytes += bytes;
        if (staged.length === 200) await flush();
      },
      (row) => normalized(db, kind, row),
    );
    if (snapshot)
      snapshots.push({
        restore: async () => {
          await snapshot(true);
          await flush();
        },
        complete: snapshot.complete,
      });
  }
  return async () => {
    for (const snapshot of snapshots) await snapshot.restore();
    for (const snapshot of snapshots) await snapshot.complete();
  };
};
