import { and, asc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { credentials } from "../../db/schemas/credentials";
export interface CredentialKey {
  extensionId: string;
  contributionId: string;
  projectId: string | null;
}
type Client = Pick<DbClient, "select" | "selectDistinct" | "insert" | "delete" | "update">;
const where = (key: CredentialKey) =>
  and(
    eq(credentials.extension_id, key.extensionId),
    eq(credentials.contribution_id, key.contributionId),
    key.projectId === null ? isNull(credentials.project_id) : eq(credentials.project_id, key.projectId),
  );
export const credentialProvider = (baseUrl: string) => new URL(baseUrl).origin;
export const createExtensionCredentialsDBService = (db: Client) => {
  const get = async (key: CredentialKey) => (await db.select().from(credentials).where(where(key)))[0] ?? null;
  return {
    get,
    async resolve(key: CredentialKey, provider: string) {
      const row = (await get(key)) ?? (await get({ ...key, projectId: null }));
      if (!row || row.provider !== provider || (row.expires_at && Date.parse(row.expires_at) <= Date.now()))
        return null;
      return row;
    },
    async upsert(
      input: CredentialKey & {
        provider: string;
        authType: "bearer" | "header";
        authHeaderName?: string | null;
        secretRef: string;
      },
    ) {
      const stamp = new Date().toISOString();
      const values = {
        provider: input.provider,
        auth_type: input.authType,
        auth_header_name: input.authHeaderName ?? null,
        secret_ref: input.secretRef,
        updated_at: stamp,
        expires_at: null,
      };
      const [row] = await db
        .insert(credentials)
        .values({
          ...values,
          id: crypto.randomUUID(),
          project_id: input.projectId,
          extension_id: input.extensionId,
          contribution_id: input.contributionId,
          created_at: stamp,
        })
        .onConflictDoUpdate({
          target: [credentials.extension_id, credentials.contribution_id, credentials.project_id],
          set: values,
        })
        .returning();
      return row!;
    },
    async remove(key: CredentialKey) {
      return (await db.delete(credentials).where(where(key)).returning())[0] ?? null;
    },
    async isReferenced(secretRef: string) {
      return (
        (
          await db
            .select({ id: credentials.id })
            .from(credentials)
            .where(eq(credentials.secret_ref, secretRef))
            .limit(1)
        ).length > 0
      );
    },
    async projectRefs(projectId: string) {
      return (
        await db.select({ ref: credentials.secret_ref }).from(credentials).where(eq(credentials.project_id, projectId))
      ).map((row) => row.ref);
    },
    async removeProjectExtension(projectId: string, extensionId: string) {
      return (
        await db
          .delete(credentials)
          .where(and(eq(credentials.project_id, projectId), eq(credentials.extension_id, extensionId)))
          .returning({ ref: credentials.secret_ref })
      ).map((row) => row.ref);
    },
    async *projectOwners() {
      let cursor: { projectId: string | null; extensionId: string } | undefined;
      while (true) {
        const rows = await db
          .selectDistinct({ projectId: credentials.project_id, extensionId: credentials.extension_id })
          .from(credentials)
          .where(
            and(
              isNotNull(credentials.project_id),
              cursor
                ? or(
                    gt(credentials.project_id, cursor.projectId!),
                    and(
                      eq(credentials.project_id, cursor.projectId!),
                      gt(credentials.extension_id, cursor.extensionId),
                    ),
                  )
                : undefined,
            ),
          )
          .orderBy(asc(credentials.project_id), asc(credentials.extension_id))
          .limit(200);
        for (const row of rows) yield { projectId: row.projectId!, extensionId: row.extensionId };
        if (rows.length < 200) return;
        cursor = rows.at(-1)!;
      }
    },
    async recordCheck(key: CredentialKey, check: NonNullable<typeof credentials.$inferSelect.last_check>) {
      await db.update(credentials).set({ last_check: check }).where(where(key));
    },
  };
};
