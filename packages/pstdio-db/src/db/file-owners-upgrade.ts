import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { eq, inArray, sql } from "drizzle-orm";
import { encodeFileScope } from "../services/extension-files/extension-files";
import type { DbClient } from "./connection.pglite";
import { cleanFileOwnerStaging, copyFileOwnerBytes, fileOwnerUuid } from "./file-owner-copies";
import { createFileOwnerExportWriter } from "./file-owner-exports";
import { timestampToIso } from "./schemas/iso-timestamp";
import { files } from "./schemas.pg";
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
// Keep capture bounded by the source reader, including joined metadata. Released
// binding fields are archived unchanged; the joined fields are private conversion input.
const captureBindings = (kind: Input["kind"]) =>
  kind === "skill"
    ? sql`SELECT b.*, row_to_json(f) AS upgrade_file, s.project_id AS upgrade_project
        FROM skill_files b LEFT JOIN files f ON f.id=b.file_id LEFT JOIN skills s ON s.id=b.skill_id`
    : sql`SELECT b.*, row_to_json(f) AS upgrade_file, s.extension_id AS upgrade_owner,
        i.scope_type AS upgrade_scope, i.scope_id AS upgrade_project
        FROM extension_files b LEFT JOIN files f ON f.id=b.file_id
        LEFT JOIN extension_instances i ON i.id=b.extension_instance_id
        LEFT JOIN installed_extension_sources s ON s.id=i.installed_extension_id`;
const normalized = async (kind: Input["kind"], input: Record<string, unknown>) => {
  const { upgrade_file, upgrade_project, upgrade_owner, upgrade_scope, ...released } = input;
  if (!upgrade_file) throw new Error("File binding does not belong to project.");
  const { owner, scope, path, ...metadata } = upgrade_file as typeof files.$inferSelect;
  const file: Metadata = {
    ...metadata,
    created_at: timestampToIso(metadata.created_at),
    updated_at: timestampToIso(metadata.updated_at),
  };
  if (file.project_id !== released.project_id) throw new Error("File binding does not belong to project.");
  let identity: Identity;
  if (kind === "skill") {
    if (upgrade_project !== file.project_id) throw new Error("Skill file does not belong to project.");
    identity = { owner: `skill:${released.skill_id}`, scope: null, path: released.path as string };
  } else {
    if (typeof upgrade_owner !== "string" || upgrade_scope !== "project" || upgrade_project !== file.project_id)
      throw new Error("Extension file does not belong to project.");
    identity = {
      owner: upgrade_owner,
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
  const file = {
    ...input.file,
    created_at: timestampToIso(input.file.created_at),
    updated_at: timestampToIso(input.file.updated_at),
  };
  const [original] = await tx.select().from(files).where(eq(files.id, file.id)).for("update");
  if (!original || !isDeepStrictEqual(baseMetadata(original), file))
    throw new Error(`Original file metadata changed: ${file.id}`);
  if (sameIdentity(original, input.identity)) return { file_id: original.id, storage_path: original.storage_path };
  if (original.owner === null && original.file_kind === input.kind) {
    await tx.update(files).set(input.identity).where(eq(files.id, original.id));
    return { file_id: original.id, storage_path: original.storage_path };
  }
  const id = fileOwnerUuid(
    JSON.stringify([file.id, file.project_id, input.identity.owner, input.identity.scope, input.identity.path]),
  );
  const storage_path = join(`${database}-owned-files`, id);
  const [existing] = await tx.select().from(files).where(eq(files.id, id));
  const metadata = { ...file, id, storage_path };
  if (existing && (!sameIdentity(existing, input.identity) || !isDeepStrictEqual(baseMetadata(existing), metadata)))
    throw new Error(`File migration UUID collision: ${id}`);
  await copyFileOwnerBytes(database, id, file, input.identity);
  if (!existing) await tx.insert(files).values({ ...metadata, ...input.identity });
  return { file_id: id, storage_path };
};
const restoreBatch = async (
  tx: Parameters<Parameters<DbClient["transaction"]>[0]>[0],
  database: string,
  batch: Input[],
) => {
  const ids = batch.map((input) => input.file.id);
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  const { rows: sizes } = await tx.execute<{ bytes: number }>(sql`
    SELECT octet_length(row_to_json(f)::text) AS bytes FROM files f
    WHERE id IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )}) FOR UPDATE`);
  // A resumed snapshot can meet changed, much larger metadata. Reject conflicts
  // one row at a time instead of hydrating an unbounded batch just to reject it.
  if (sizes.reduce((bytes, row) => bytes + row.bytes, 0) > 4 * 1024 * 1024) {
    const mappings = [];
    for (const input of batch) mappings.push({ ...input, converted: await restore(tx, database, input) });
    return mappings;
  }
  const originals = new Map(
    (await tx.select().from(files).where(inArray(files.id, ids)).for("update")).map((row) => [row.id, row]),
  );
  const claims: Array<Identity & { id: string }> = [];
  const mappings = [];
  for (const input of batch) {
    const original = originals.get(input.file.id);
    // Shared originals must retain the ordered per-binding copy logic. Only an
    // unambiguous original can acquire its owner in the single batch update.
    if (counts.get(input.file.id) === 1 && original?.owner === null && original.file_kind === input.kind) {
      const expected = {
        ...input.file,
        created_at: timestampToIso(input.file.created_at),
        updated_at: timestampToIso(input.file.updated_at),
      };
      if (!isDeepStrictEqual(baseMetadata(original), expected))
        throw new Error(`Original file metadata changed: ${input.file.id}`);
      claims.push({ id: original.id, ...input.identity });
      mappings.push({ ...input, converted: { file_id: original.id, storage_path: original.storage_path } });
    } else mappings.push({ ...input, converted: await restore(tx, database, input) });
  }
  if (claims.length)
    await tx.execute(sql`UPDATE files f SET owner=c.owner,scope=c.scope,path=c.path
      FROM jsonb_to_recordset(${JSON.stringify(claims)}::jsonb) AS c(id text,owner text,scope text,path text)
      WHERE f.id=c.id`);
  return mappings;
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
      const mappings = await db.transaction((tx) => restoreBatch(tx, path, batch));
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
        select: captureBindings(kind),
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
      (row) => normalized(kind, row),
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
