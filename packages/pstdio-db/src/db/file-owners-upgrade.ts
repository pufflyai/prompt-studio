import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { eq, sql } from "drizzle-orm";
import { encodeFileScope } from "../services/extension-files/extension-files";
import { fileColumns } from "../services/files/files";
import type { DbClient } from "./connection.pglite";
import { cleanFileOwnerStaging, copyFileOwnerBytes, fileOwnerUuid } from "./file-owner-copies";
import { writeFileOwnerExport } from "./file-owner-exports";
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
const restore = async (db: DbClient, database: string, input: Input) => {
  const result = await db.transaction(async (tx) => {
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
  });
  await writeFileOwnerExport(database, "mappings", input.key, { ...input, converted: result });
};
export const prepareFileOwnersUpgrade = async (db: DbClient, path: string) => {
  await cleanFileOwnerStaging(path);
  const snapshots: Array<Awaited<ReturnType<typeof prepareUpgradeSnapshot>>> = [];
  for (const kind of ["skill", "extension"] as const) {
    snapshots.push(
      await prepareUpgradeSnapshot(
        db,
        path,
        {
          table: `${kind}_files`,
          keys: kind === "skill" ? ["skill_id", "path"] : ["id"],
          name: `${kind}-files`,
          archive: `${kind}-files`,
        },
        (row) => restore(db, path, row as unknown as Input),
        (row) => normalized(db, kind, row),
      ),
    );
  }
  return async () => {
    for (const snapshot of snapshots) await snapshot?.(true);
    for (const snapshot of snapshots) await snapshot?.complete();
  };
};
