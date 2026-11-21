import { and, asc, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { automation_tokens } from "../../db/schemas.pg";
import { automationTokenOwner, disabledAutomationOwner, getAutomationOwner } from "./automation-owners";

const nowTimestamp = () => new Date().toISOString();
export const createAutomationTokenDBService = (db: DbClient) => {
  const createToken = async (input: {
    name: string;
    createdBy: string;
    principalId?: string;
    tokenId: string;
    tokenPrefix: string;
    tokenDigest: string;
    projectId: string;
    commandScopes: string[];
    expiresAt: string;
  }) =>
    db.transaction(async (tx) => {
      const createdAt = nowTimestamp();
      const existing = input.principalId ? await getAutomationOwner(tx, input.projectId, input.principalId) : null;
      if (input.principalId && !existing) throw new Error("Automation principal not found for project.");
      const principal = existing ?? {
        id: crypto.randomUUID(),
        project_id: input.projectId,
        name: input.name,
        created_by: input.createdBy,
        created_at: createdAt,
        disabled_at: null,
      };
      const [token] = await tx
        .insert(automation_tokens)
        .values({
          id: input.tokenId,
          principal_id: principal.id,
          name: principal.name,
          created_by: principal.created_by,
          principal_created_at: principal.created_at,
          token_prefix: input.tokenPrefix,
          token_digest: input.tokenDigest,
          project_id: input.projectId,
          command_scopes_json: input.commandScopes,
          expires_at: input.expiresAt,
          last_used_at: null,
          revoked_at: principal.disabled_at,
          created_at: createdAt,
        })
        .returning();
      return { principal, token };
    });
  const withOwner = async (token: typeof automation_tokens.$inferSelect) => {
    const { name, created_by, principal_created_at, ...record } = token;
    return {
      principal: automationTokenOwner(token, await disabledAutomationOwner(db, token.project_id, token.principal_id)),
      token: record,
    };
  };
  const getToken = async (id: string) => {
    const [token] = await db.select().from(automation_tokens).where(eq(automation_tokens.id, id));
    return token ? withOwner(token) : null;
  };
  const listTokens = async (projectId: string) =>
    Promise.all(
      (
        await db
          .select()
          .from(automation_tokens)
          .where(eq(automation_tokens.project_id, projectId))
          .orderBy(asc(automation_tokens.created_at))
      ).map(withOwner),
    );
  const markTokenUsed = (id: string) =>
    db.update(automation_tokens).set({ last_used_at: nowTimestamp() }).where(eq(automation_tokens.id, id));
  const revokeToken = async (id: string) => {
    const [row] = await db
      .update(automation_tokens)
      .set({ revoked_at: nowTimestamp() })
      .where(and(eq(automation_tokens.id, id), isNull(automation_tokens.revoked_at)))
      .returning();
    if (!row) return (await getToken(id))?.token ?? null;
    return (await withOwner(row)).token;
  };
  return {
    createToken,
    getPrincipal: (projectId: string, id: string) => getAutomationOwner(db, projectId, id),
    getToken,
    listTokens,
    markTokenUsed,
    revokeToken,
  };
};
