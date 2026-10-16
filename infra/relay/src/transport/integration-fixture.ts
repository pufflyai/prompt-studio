import { strict as assert } from "node:assert";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Client } from "pg";
import {
  createAccountManager,
  createEnvironmentAuthorityClient,
  createEnvironmentAuthorityHandler,
  migrateAccountManager,
} from "pstdio-account-manager";
import { createRelayAssets } from "../assets/assets";
import { migrateRelayStorage } from "../storage/database";
import { createRelayStorage } from "../storage/storage";
import { createFixtureTls } from "./tls.fixture";

export const createTransportFixture = () => {
  const input = process.env.SYNC_TEST_DATABASE_URL;
  const endpoint = process.env.SYNC_TEST_OBJECT_ENDPOINT;
  if (!input || !endpoint) throw new Error("Run through the isolated relay transport fixture");
  const admin = new Client({ connectionString: input });
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const database = (name: string) => {
    const role = `${name}_${suffix}`;
    const url = new URL(input);
    url.username = role;
    url.password = `${role}-test-only`;
    url.pathname = `/${role}`;
    return { role, url: url.href, password: url.password };
  };
  const managerDatabase = database("manager");
  const relayDatabase = database("relay");
  const bucket = `relay-transport-${crypto.randomUUID()}`;
  const s3 = {
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: "conformance-access", secretAccessKey: "conformance-secret-only" },
  };
  const objects = new S3Client({ ...s3, maxAttempts: 1 });
  return {
    relayDatabaseUrl: relayDatabase.url,
    managerDatabaseUrl: managerDatabase.url,
    async initialize() {
      await admin.connect();
      for (const target of [managerDatabase, relayDatabase]) {
        await admin.query(`CREATE ROLE "${target.role}" LOGIN PASSWORD '${target.password}'`);
        await admin.query(`CREATE DATABASE "${target.role}" OWNER "${target.role}"`);
        await admin.query(`REVOKE ALL ON DATABASE "${target.role}" FROM PUBLIC`);
        await admin.query(`GRANT CONNECT ON DATABASE "${target.role}" TO "${target.role}"`);
      }
      await migrateAccountManager(
        managerDatabase.url,
        new URL("../drizzle/", import.meta.resolve("pstdio-account-manager")).pathname,
      );
      await migrateRelayStorage(relayDatabase.url, new URL("../../drizzle/", import.meta.url).pathname);
      await objects.send(new CreateBucketCommand({ Bucket: bucket }));
    },
    async disconnectRelayListeners() {
      await admin.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND application_name = 'pstdio-relay-changes'",
        [relayDatabase.role],
      );
    },
    async blockRelayData() {
      const client = new Client({ connectionString: relayDatabase.url });
      await client.connect();
      await client.query("BEGIN");
      await client.query("LOCK relay_scopes IN ACCESS EXCLUSIVE MODE");
      return async () => {
        await client.query("ROLLBACK");
        await client.end();
      };
    },
    async waitForBlockedData(count = 1) {
      while (true) {
        const result = await admin.query(
          "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1 AND wait_event_type = 'Lock'",
          [relayDatabase.role],
        );
        if (result.rows[0].count >= count) return;
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    },
    async context(options: { workbenchId?: string; environmentId?: string; expiresAt?: string; tls?: boolean } = {}) {
      const manager = createAccountManager(managerDatabase.url);
      const assets = createRelayAssets({ databaseUrl: relayDatabase.url, bucket, s3 });
      const storage = createRelayStorage(relayDatabase.url, assets);
      const serviceSecret = `fixture-service-${crypto.randomUUID()}`;
      const tls = options.tls ? await createFixtureTls() : undefined;
      const privateServer = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        ...(tls ? { tls: tls.config } : {}),
        fetch: createEnvironmentAuthorityHandler(manager, { serviceSecret }),
      });
      let checks = 0;
      const authority = createEnvironmentAuthorityClient(
        {
          origin: "https://manager.example.test",
          serviceSecret,
          requestTimeoutMs: 1000,
        },
        async (url, options) => {
          assert.equal(url, "https://manager.example.test/internal/v1/environment-authority");
          checks++;
          return fetch(new URL(new URL(url).pathname, privateServer.url), options);
        },
      );
      const scope = {
        accountId: crypto.randomUUID(),
        workbenchId: options.workbenchId ?? crypto.randomUUID(),
        extensionId: "notes",
      };
      const environmentId = options.environmentId ?? crypto.randomUUID();
      const close = async () => {
        await privateServer.stop(true);
        await Promise.all([storage.close(), assets.close(), manager.close()]);
        await tls?.close();
      };
      try {
        await manager.provision({
          requestId: "provision",
          accountId: scope.accountId,
          owner: { issuer: "https://accounts.google.com", subject: scope.accountId },
        });
        const grant = await manager.register({
          requestId: "register",
          accountId: scope.accountId,
          workbenchId: scope.workbenchId,
          environmentId,
          expiresAt: options.expiresAt ?? new Date(Date.now() + 60_000).toISOString(),
        });
        await storage.initialize(scope, "published-notes");
        return {
          scope,
          environmentId,
          token: grant.token!,
          storage,
          assets,
          authority,
          manager,
          grant,
          checks: () => checks,
          stopAuthority: () => privateServer.stop(true),
          serverEnv: {
            DATABASE_URL: relayDatabase.url,
            S3_ENDPOINT: endpoint,
            S3_BUCKET: bucket,
            S3_REGION: s3.region,
            S3_ACCESS_KEY_ID: s3.credentials.accessKeyId,
            S3_SECRET_ACCESS_KEY: s3.credentials.secretAccessKey,
            MANAGER_ORIGIN: privateServer.url.origin,
            MANAGER_SERVICE_SECRET: serviceSecret,
            MANAGER_REQUEST_TIMEOUT_MS: "1000",
            RELAY_SUBSCRIPTION_CHECK_INTERVAL_MS: "20",
            ...(tls ? { NODE_EXTRA_CA_CERTS: tls.cert } : {}),
          },
          close,
        };
      } catch (error) {
        await close();
        throw error;
      }
    },
    async close() {
      objects.destroy();
      await admin.end();
    },
  };
};
