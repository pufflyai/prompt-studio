import { createEnvironmentAuthorityClient } from "pstdio-account-manager/client";
import { createRelayAssets } from "./assets/assets";
import { createRelayStorage } from "./storage/storage";

export const createRelayRuntime = (env: Record<string, string | undefined>) => {
  try {
    const required = (name: string) => {
      const value = env[name];
      if (!value) throw new Error(`Relay requires ${name}`);
      return value;
    };
    const positive = (name: string) => {
      const value = Number(required(name));
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Relay requires a positive integer ${name}`);
      return value;
    };
    const databaseUrl = required("DATABASE_URL");
    const bucket = required("S3_BUCKET");
    const s3 = {
      endpoint: required("S3_ENDPOINT"),
      region: required("S3_REGION"),
      forcePathStyle: true,
      credentials: { accessKeyId: required("S3_ACCESS_KEY_ID"), secretAccessKey: required("S3_SECRET_ACCESS_KEY") },
    };
    const subscriptionCheckIntervalMs = positive("RELAY_SUBSCRIPTION_CHECK_INTERVAL_MS");
    const authority = createEnvironmentAuthorityClient({
      origin: required("MANAGER_ORIGIN"),
      serviceSecret: required("MANAGER_SERVICE_SECRET"),
      requestTimeoutMs: positive("MANAGER_REQUEST_TIMEOUT_MS"),
    });
    const assets = createRelayAssets({ databaseUrl, bucket, s3 });
    const storage = createRelayStorage(databaseUrl, assets);
    return {
      authority,
      assets,
      storage,
      subscriptionCheckIntervalMs,
      async close() {
        const results = await Promise.allSettled([storage.close(), assets.close()]);
        if (results.some((result) => result.status === "rejected")) throw new Error("Relay storage shutdown failed");
      },
    };
  } catch {
    throw new Error("Relay configuration is invalid");
  }
};
