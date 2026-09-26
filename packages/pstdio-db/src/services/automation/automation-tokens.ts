import { and, asc, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { automation_principals, automation_tokens } from "../../db/schemas.pg";

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
  }) => {
    const createdAt = nowTimestamp();
    return db.transaction(async (tx) => {
      const [existingPrincipal] = input.principalId
        ? await tx
            .select()
            .from(automation_principals)
            .where(
              and(
                eq(automation_principals.id, input.principalId),
                eq(automation_principals.project_id, input.projectId),
              ),
            )
        : [];
      if (input.principalId && !existingPrincipal) throw new Error("Automation principal not found for project.");
      const principal =
        existingPrincipal ??
        (
          await tx
            .insert(automation_principals)
            .values({
              id: crypto.randomUUID(),
              project_id: input.projectId,
              name: input.name,
              created_by: input.createdBy,
              created_at: createdAt,
              disabled_at: null,
            })
            .returning()
        )[0];
      const [token] = await tx
        .insert(automation_tokens)
        .values({
          id: input.tokenId,
          principal_id: principal.id,
          token_prefix: input.tokenPrefix,
          token_digest: input.tokenDigest,
          project_id: input.projectId,
          command_scopes_json: input.commandScopes,
          expires_at: input.expiresAt,
          last_used_at: null,
          revoked_at: null,
          created_at: createdAt,
        })
        .returning();
      return { principal, token };
    });
  };

  const getToken = async (id: string) => {
    const [row] = await db
      .select({ principal: automation_principals, token: automation_tokens })
      .from(automation_tokens)
      .innerJoin(automation_principals, eq(automation_tokens.principal_id, automation_principals.id))
      .where(eq(automation_tokens.id, id));
    return row ?? null;
  };

  const getPrincipal = async (projectId: string, principalId: string) => {
    const [principal] = await db
      .select()
      .from(automation_principals)
      .where(and(eq(automation_principals.id, principalId), eq(automation_principals.project_id, projectId)));
    return principal ?? null;
  };

  const listTokens = (projectId: string) =>
    db
      .select({ principal: automation_principals, token: automation_tokens })
      .from(automation_tokens)
      .innerJoin(automation_principals, eq(automation_tokens.principal_id, automation_principals.id))
      .where(eq(automation_tokens.project_id, projectId))
      .orderBy(asc(automation_tokens.created_at));

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

  return { createToken, getPrincipal, getToken, listTokens, markTokenUsed, revokeToken };
};
