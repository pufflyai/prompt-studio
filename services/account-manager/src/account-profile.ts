import { and, eq } from "drizzle-orm";
import { decodeJwt } from "jose";
import { z } from "zod";
import { account } from "./auth-schema";
import type { ManagerDatabase } from "./database";
import { microsoftIssuerSchema } from "./microsoft-provider";
import { accounts } from "./schema";

/** Display metadata only. Account ownership and feature grants never use these mutable claims. */
export const createAccountProfileReader =
  (clientId: string | undefined) => async (db: Pick<ManagerDatabase, "select">, accountId: string) => {
    if (!clientId) return undefined;
    const [owner] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    if (!owner || !microsoftIssuerSchema.safeParse(owner.ownerIssuer).success || !owner.ownerSubject) return undefined;
    const tenant = new URL(owner.ownerIssuer!).pathname.split("/")[1];
    const [provider] = await db
      .select({ idToken: account.idToken })
      .from(account)
      .where(and(eq(account.providerId, "microsoft"), eq(account.accountId, `${tenant}:${owner.ownerSubject}`)));
    if (!provider?.idToken) return undefined;
    try {
      // The provider validated this token before storage. Read it only for display, bound to its original owner.
      const profile = decodeJwt(provider.idToken);
      if (profile.iss !== owner.ownerIssuer || profile.sub !== owner.ownerSubject || profile.aud !== clientId)
        return undefined;
      for (const candidate of [profile.email, profile.preferred_username]) {
        const email = z.email().safeParse(candidate);
        if (email.success) return { email: email.data };
      }
    } catch {
      // Missing profile data must not prevent an otherwise valid device from using its account.
    }
    return undefined;
  };
