import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_files, files } from "../../db/schemas.pg";

interface ExtensionFileScope {
  project_id: string;
  extension_instance_id: string;
  scope_type: string;
  scope_id: string | null;
}

const nowTimestamp = () => new Date().toISOString();

const scopeConditions = (scope: ExtensionFileScope) => [
  eq(extension_files.project_id, scope.project_id),
  eq(extension_files.extension_instance_id, scope.extension_instance_id),
  eq(extension_files.scope_type, scope.scope_type),
  scope.scope_id === null ? isNull(extension_files.scope_id) : eq(extension_files.scope_id, scope.scope_id),
];

export const createExtensionFilesDBService = (db: DbClient) => {
  const attach = async (input: ExtensionFileScope & { file_id: string }) => {
    const row = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      extension_instance_id: input.extension_instance_id,
      file_id: input.file_id,
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      created_at: nowTimestamp(),
    };
    await db.insert(extension_files).values(row);
    return row;
  };

  const list = async (scope: ExtensionFileScope) => {
    const rows = await db
      .select({ file: files })
      .from(extension_files)
      .innerJoin(files, eq(extension_files.file_id, files.id))
      .where(and(...scopeConditions(scope)))
      .orderBy(extension_files.created_at);

    return rows.map((row) => row.file);
  };

  const getOwnedFile = async (
    input: Pick<ExtensionFileScope, "project_id" | "extension_instance_id"> & { file_id: string },
  ) => {
    const [row] = await db
      .select({ file: files })
      .from(extension_files)
      .innerJoin(files, eq(extension_files.file_id, files.id))
      .where(
        and(
          eq(extension_files.project_id, input.project_id),
          eq(extension_files.extension_instance_id, input.extension_instance_id),
          eq(extension_files.file_id, input.file_id),
        ),
      );

    return row?.file ?? null;
  };

  const detach = async (
    input: Pick<ExtensionFileScope, "project_id" | "extension_instance_id"> & { file_id: string },
  ) => {
    const deleted = await db
      .delete(extension_files)
      .where(
        and(
          eq(extension_files.project_id, input.project_id),
          eq(extension_files.extension_instance_id, input.extension_instance_id),
          eq(extension_files.file_id, input.file_id),
        ),
      )
      .returning({ id: extension_files.id });

    return deleted.length > 0;
  };

  return { attach, list, getOwnedFile, detach };
};
