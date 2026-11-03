import { createEnvironmentAccessVerifier } from "pstdio-account-manager/access";
import type { ReportFailure } from "pstdio-service-telemetry";
import { createRelayAssets } from "./assets/assets";
import { readRelayLimits } from "./limits";
import { readRuntimeSecrets } from "./runtime-secrets";
import { scheduleSyncCleanup } from "./storage/cleanup";
import { createSyncOwners } from "./transport/owners";

// Cleanup only has to keep pace with the grace period, so an hourly run is enough.
const cleanupIntervalMs = 60 * 60 * 1000;

export const createRelayRuntime = (env: Record<string, string | undefined>, report: ReportFailure = () => {}) => {
  try {
    const required = (name: string) => {
      const value = env[name];
      if (!value) throw new Error(`Relay requires ${name}`);
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
    const secrets = readRuntimeSecrets(env);
    const verifyAccess = createEnvironmentAccessVerifier(secrets.trust);
    const assets = createRelayAssets({ databaseUrl, bucket, s3 });
    const sync = createSyncOwners({ databaseUrl, bucket, s3, assets, limits: readRelayLimits(env) });
    const stopCleanup = scheduleSyncCleanup(
      (signal) => sync.sync.cleanup(undefined, signal),
      cleanupIntervalMs,
      () => report("sync_cleanup_failed"),
    );
    return {
      verifyAccess,
      assets,
      ...sync,
      async close() {
        await stopCleanup();
        const results = await Promise.allSettled([sync.sync.close(), assets.close()]);
        if (results.some((result) => result.status === "rejected")) throw new Error("Relay storage shutdown failed");
      },
    };
  } catch {
    throw new Error("Relay configuration is invalid");
  }
};
