import { createEnvironmentAccessVerifier } from "pstdio-account-manager/access";
import type { ReportFailure, ServiceMonitoring } from "pstdio-service-telemetry";
import { createRelayAssets } from "./assets/assets";
import { readRelayLimits } from "./limits";
import { createProjectDeletionWorker } from "./project-deletion-worker";
import { readRuntimeSecrets } from "./runtime-secrets";
import { scheduleSyncCleanup } from "./storage/cleanup";
import { createSyncOwners } from "./transport/owners";

// Cleanup only has to keep pace with the grace period, so an hourly run is enough.
const cleanupIntervalMs = 60 * 60 * 1000;

export const createRelayRuntime = (
  env: Record<string, string | undefined>,
  report: ReportFailure = () => {},
  monitoring?: ServiceMonitoring,
) => {
  try {
    const required = (name: string) => {
      const value = env[name];
      if (!value) throw new Error(`Relay requires ${name}`);
      return value;
    };
    const databaseUrl = required("DATABASE_URL");
    const poolMax = env.DATABASE_POOL_MAX === undefined ? undefined : Number(env.DATABASE_POOL_MAX);
    if (poolMax !== undefined && (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 100))
      throw new Error("DATABASE_POOL_MAX must be an integer from 1 to 100");
    const bucket = required("S3_BUCKET");
    const s3 = {
      endpoint: required("S3_ENDPOINT"),
      region: required("S3_REGION"),
      forcePathStyle: true,
      credentials: { accessKeyId: required("S3_ACCESS_KEY_ID"), secretAccessKey: required("S3_SECRET_ACCESS_KEY") },
    };
    const secrets = readRuntimeSecrets(env);
    const verifyAccess = createEnvironmentAccessVerifier(secrets.trust);
    const assets = createRelayAssets({ databaseUrl, bucket, s3, poolMax });
    const sync = createSyncOwners({ databaseUrl, bucket, s3, assets, limits: readRelayLimits(env), poolMax });
    const stopCleanup = scheduleSyncCleanup(
      (signal) =>
        monitoring
          ? monitoring.cleanup(() => sync.sync.cleanup(undefined, signal))
          : sync.sync.cleanup(undefined, signal),
      cleanupIntervalMs,
      () => report("sync_cleanup_failed"),
    );
    const deletionToken = env.PROJECT_DELETION_RELAY_TOKEN;
    const stopDeletion = deletionToken
      ? scheduleSyncCleanup(
          createProjectDeletionWorker({
            managerUrl: secrets.trust.issuer,
            token: deletionToken,
            deleteProject: sync.sync.deleteProject,
          }),
          2_000,
          () => report("project_deletion_handoff_failed"),
        )
      : undefined;
    return {
      verifyAccess,
      assets,
      ...sync,
      async close() {
        await Promise.all([stopCleanup(), stopDeletion?.()]);
        const results = await Promise.allSettled([sync.sync.close(), assets.close()]);
        if (results.some((result) => result.status === "rejected")) throw new Error("Relay storage shutdown failed");
      },
    };
  } catch {
    throw new Error("Relay configuration is invalid");
  }
};
