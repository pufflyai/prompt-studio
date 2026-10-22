import { resolve } from "node:path";
import { SQL } from "bun";
import type * as Authority from "./index";

export const createAuthorityFixture = (implementation: typeof Authority) => {
  const input = process.env.MANAGER_TEST_ADMIN_URL;
  if (!input) throw new Error("Run account authority tests through test:isolated");
  const admin = new SQL(input);
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const managerRole = `manager_${suffix}`;
  const relayRole = `relay_${suffix}`;
  const managerDatabase = `authority_${suffix}`;
  const relayDatabase = `content_${suffix}`;
  const connection = (role: string, database: string) => {
    const url = new URL(input);
    url.username = role;
    url.password = `${role}-test-only`;
    url.pathname = `/${database}`;
    return url.href;
  };
  const databaseUrl = connection(managerRole, managerDatabase);
  return {
    databaseUrl,
    relayUrl: connection(relayRole, managerDatabase),
    relayContentUrl: connection(relayRole, relayDatabase),
    async initialize(migrationsFolder = resolve(import.meta.dir, "../drizzle")) {
      await admin.unsafe(`CREATE ROLE "${managerRole}" LOGIN PASSWORD '${managerRole}-test-only'`);
      await admin.unsafe(`CREATE ROLE "${relayRole}" LOGIN PASSWORD '${relayRole}-test-only'`);
      await admin.unsafe(`CREATE DATABASE "${managerDatabase}" OWNER "${managerRole}"`);
      await admin.unsafe(`CREATE DATABASE "${relayDatabase}" OWNER "${relayRole}"`);
      await admin.unsafe(`REVOKE ALL ON DATABASE "${managerDatabase}" FROM PUBLIC`);
      await admin.unsafe(`GRANT CONNECT ON DATABASE "${managerDatabase}" TO "${managerRole}"`);
      await implementation.migrateAccountManager(databaseUrl, migrationsFolder);
    },
    owner: () => implementation.createAccountManager(databaseUrl),
    close: () => admin.close(),
  };
};

export const provisionAccount = async (owner: ReturnType<typeof Authority.createAccountManager>) => {
  const accountId = crypto.randomUUID();
  await owner.provision({
    requestId: "provision",
    accountId,
    owner: { issuer: "https://accounts.google.com", subject: accountId },
  });
  return accountId;
};
export const deviceProfile = (deviceId: string = crypto.randomUUID()) => ({
  deviceId,
  name: "Fixture device",
  platform: "linux",
});

// Logs a device in to a provisioned account and makes the workbench one of its cloud projects.
export const connectDevice = async (
  owner: ReturnType<typeof Authority.createAccountManager>,
  accountId: string,
  workbenchId = "workbench",
) => {
  await owner.addWorkbench({ accountId, workbenchId });
  return { ...(await owner.registerDevice({ accountId, ...deviceProfile() })), workbenchId };
};
