import { eq } from "drizzle-orm";
import { account } from "./auth-schema";
import type { ManagerDatabase } from "./database";
import { microsoftAccountIdentity } from "./microsoft-provider";

export const googleIssuer = "https://accounts.google.com";

export const readProviderIdentity = async (db: ManagerDatabase, userId: string) => {
  const providers = await db
    .select({ key: account.accountId, id: account.providerId })
    .from(account)
    .where(eq(account.userId, userId))
    .limit(2);
  if (providers.length !== 1) return null;
  const [provider] = providers;
  if (provider.id === "google") return { provider: "google", issuer: googleIssuer, subject: provider.key } as const;
  if (provider.id !== "microsoft") return null;
  const identity = microsoftAccountIdentity(provider.key);
  return identity ? ({ provider: "microsoft", ...identity } as const) : null;
};
