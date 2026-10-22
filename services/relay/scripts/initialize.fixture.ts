import { Client } from "pg";
import { createAccountManager, migrateAccountManager } from "pstdio-account-manager";
import { createRelayAssets, createRelayStorage, migrateRelayStorage } from "../src/index";
import { initializeRecoveryKey } from "../src/recovery-key";
import { createFixtureAuthentication, fixtureManagerConfig } from "./manager.fixture";

await initializeRecoveryKey("/recovery/key");

if (process.env.FIXTURE_ADMIN_URL) {
  const admin = new Client({ connectionString: process.env.FIXTURE_ADMIN_URL });
  await admin.connect();
  try {
    for (const name of ["manager_owner", "relay_owner"]) {
      await admin.query(`CREATE ROLE ${name} LOGIN PASSWORD '${name}_fixture_only'`);
      await admin.query(`CREATE DATABASE ${name} OWNER ${name}`);
      await admin.query(`REVOKE ALL ON DATABASE ${name} FROM PUBLIC`);
      await admin.query(`GRANT CONNECT ON DATABASE ${name} TO ${name}`);
    }
  } finally {
    await admin.end();
  }
}
const managerUrl = process.env.MANAGER_DATABASE_URL!;
const databaseUrl = process.env.DATABASE_URL!;
await migrateAccountManager(managerUrl, "/app/manager-drizzle");
await migrateRelayStorage(databaseUrl, "/app/drizzle");
const manager = createAccountManager(managerUrl);
const auth = createFixtureAuthentication();
const assets = createRelayAssets({
  databaseUrl,
  bucket: process.env.S3_BUCKET!,
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  },
});
const storage = createRelayStorage(databaseUrl, assets);
try {
  const scope = {
    accountId: "built-network-account",
    workbenchId: "built-network-workbench",
    extensionId: process.env.RELAY_FIXTURE_EXTENSION_ID ?? "notes",
  };
  await manager.provision({
    requestId: "provision",
    accountId: scope.accountId,
    owner: { issuer: "https://accounts.google.com", subject: "built-owner" },
  });
  await manager.setFeature({ accountId: scope.accountId, feature: "relay", enabled: true });
  await manager.addWorkbench({ accountId: scope.accountId, workbenchId: scope.workbenchId });
  const device = await manager.registerDevice({
    accountId: scope.accountId,
    deviceId: "built-network-environment",
    name: "Built network smoke",
    platform: "linux",
  });
  await storage.initialize(scope, "published-network");
  await Bun.write(
    "/fixture/grant.json",
    JSON.stringify({ scope, token: device.token, environmentId: device.deviceId }),
  );
  const config = fixtureManagerConfig(managerUrl);
  await Bun.write(
    "/access-trust/trust.json",
    JSON.stringify({ issuer: config.origin, audience: config.audience, jwks: await auth.jwks() }),
  );
  console.log("Built fixture initialized separate authority and relay roles");
} finally {
  await Promise.all([storage.close(), assets.close(), manager.close(), auth.close()]);
}
