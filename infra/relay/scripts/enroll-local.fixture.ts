import { createAccountManager } from "pstdio-account-manager";
import { identitySchema } from "pstdio-sync-contracts";

const input = (await new Response(Bun.stdin.stream()).json()) as { environmentId: unknown; workbenchId: unknown };
const environmentId = identitySchema.parse(input.environmentId);
const workbenchId = identitySchema.parse(input.workbenchId);
const manager = createAccountManager(process.env.DATABASE_URL!);
try {
  // The launcher enrolls missing or denied grants; other workbenches share this environment.
  const grant = await manager.register({
    requestId: crypto.randomUUID(),
    accountId: "built-network-account",
    environmentId,
    workbenchId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  process.stdout.write(JSON.stringify({ token: grant.token }));
} finally {
  await manager.close();
}
