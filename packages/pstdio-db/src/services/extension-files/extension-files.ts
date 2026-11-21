import { and, eq, isNull, or } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { files } from "../../db/schemas.pg";
import { getExtensionStorageOwner } from "../extension-storage/storage-owner";
import { fileColumns } from "../files/files";

interface ExtensionFileScope {
  project_id: string;
  extension_instance_id: string;
  scope_type: string;
  scope_id: string | null;
}
export const encodeFileScope = (scope: Pick<ExtensionFileScope, "scope_type" | "scope_id">) =>
  JSON.stringify([scope.scope_type, scope.scope_id]);
const ownerFor = async (
  db: Pick<DbClient, "select">,
  input: Pick<ExtensionFileScope, "project_id" | "extension_instance_id">,
) => {
  const owner = await getExtensionStorageOwner(db, input.extension_instance_id);
  return owner?.workbenchId === input.project_id ? owner.extensionId : null;
};
export const createExtensionFilesDBService = (db: DbClient) => {
  const attach = (input: ExtensionFileScope & { file_id: string }) =>
    db.transaction(async (tx) => {
      const owner = await ownerFor(tx, input);
      if (!owner) throw new Error("Extension file owner is not in this project.");
      const [file] = await tx
        .update(files)
        .set({ owner, scope: encodeFileScope(input), path: null })
        .where(
          and(
            eq(files.id, input.file_id),
            eq(files.project_id, input.project_id),
            or(isNull(files.owner), eq(files.owner, "pstdio")),
          ),
        )
        .returning(fileColumns);
      if (!file) throw new Error("File already belongs to another owner or project.");
      return {
        id: file.id,
        project_id: input.project_id,
        extension_instance_id: input.extension_instance_id,
        file_id: file.id,
        scope_type: input.scope_type,
        scope_id: input.scope_id,
        created_at: file.created_at,
      };
    });
  const list = async (input: ExtensionFileScope) => {
    const owner = await ownerFor(db, input);
    if (!owner) return [];
    return db
      .select(fileColumns)
      .from(files)
      .where(
        and(eq(files.project_id, input.project_id), eq(files.owner, owner), eq(files.scope, encodeFileScope(input))),
      )
      .orderBy(files.created_at, files.id);
  };
  const getOwnedFile = async (
    input: Pick<ExtensionFileScope, "project_id" | "extension_instance_id"> & { file_id: string },
  ) => {
    const owner = await ownerFor(db, input);
    if (!owner) return null;
    const [file] = await db
      .select({ ...fileColumns, scope: files.scope })
      .from(files)
      .where(and(eq(files.id, input.file_id), eq(files.project_id, input.project_id), eq(files.owner, owner)));
    if (!file?.scope) return null;
    const { scope, ...value } = file;
    const [scope_type, scope_id] = JSON.parse(scope) as [string, string | null];
    return { ...value, scope_type, scope_id };
  };
  const detach = async (
    input: Pick<ExtensionFileScope, "project_id" | "extension_instance_id"> & { file_id: string },
  ) => {
    const owner = await ownerFor(db, input);
    if (!owner) return false;
    return (
      (
        await db
          .update(files)
          .set({ owner: null, scope: null, path: null })
          .where(and(eq(files.id, input.file_id), eq(files.project_id, input.project_id), eq(files.owner, owner)))
          .returning({ id: files.id })
      ).length > 0
    );
  };
  return { attach, list, getOwnedFile, detach };
};
