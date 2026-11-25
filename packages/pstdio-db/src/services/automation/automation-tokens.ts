import { and, asc, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { automation_tokens } from "../../db/schemas.pg";
import { automationTokenOwner } from "./automation-owners";

const nowTimestamp = () => new Date().toISOString();
const withOwner = (token: typeof automation_tokens.$inferSelect) => ({ principal: automationTokenOwner(token), token });
export const createAutomationTokenDBService = (db: DbClient) => {
  const createToken = async (input: {
    name: string;
    createdBy: string;
    tokenId: string;
    tokenPrefix: string;
    tokenDigest: string;
    projectId: string;
    commandScopes: string[];
    expiresAt: string;
  }) => {
    const [token] = await db
      .insert(automation_tokens)
      .values({
        id: input.tokenId,
        name: input.name,
        created_by: input.createdBy,
        token_prefix: input.tokenPrefix,
        token_digest: input.tokenDigest,
        project_id: input.projectId,
        command_scopes_json: input.commandScopes,
        expires_at: input.expiresAt,
        last_used_at: null,
        revoked_at: null,
        created_at: nowTimestamp(),
      })
      .returning();
    return withOwner(token);
  };
  const getToken = async (id: string) => {
    const [token] = await db.select().from(automation_tokens).where(eq(automation_tokens.id, id));
    return token ? withOwner(token) : null;
  };
  const listTokens = async (projectId: string) =>
    (
      await db
        .select()
        .from(automation_tokens)
        .where(eq(automation_tokens.project_id, projectId))
        .orderBy(asc(automation_tokens.created_at))
    ).map(withOwner);
  const markTokenUsed = (id: string) =>
    db.update(automation_tokens).set({ last_used_at: nowTimestamp() }).where(eq(automation_tokens.id, id));
  const revokeToken = async (id: string) => {
    const [row] = await db
      .update(automation_tokens)
      .set({ revoked_at: nowTimestamp() })
      .where(and(eq(automation_tokens.id, id), isNull(automation_tokens.revoked_at)))
      .returning();
    return row ?? (await getToken(id))?.token ?? null;
  };
  return { createToken, getToken, listTokens, markTokenUsed, revokeToken };
};
