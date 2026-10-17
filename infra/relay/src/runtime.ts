import { readFileSync } from "node:fs";
import { createEnvironmentAccessVerifier } from "pstdio-account-manager/access";
import { createRelayAssets } from "./assets/assets";
import { createRecoveryProofs } from "./recovery-proofs";
import { createRelayStorage } from "./storage/storage";

export const createRelayRuntime = (env: Record<string, string | undefined>) => {
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
    const verifyAccess = createEnvironmentAccessVerifier(
      JSON.parse(readFileSync(required("RELAY_ACCESS_TRUST_FILE"), "utf8")),
    );
    const recovery = createRecoveryProofs(readFileSync(required("RELAY_RECOVERY_KEY_FILE")));
    const assets = createRelayAssets({ databaseUrl, bucket, s3 });
    const storage = createRelayStorage(databaseUrl, assets);
    return {
      verifyAccess,
      recovery,
      assets,
      storage,
      async close() {
        const results = await Promise.allSettled([storage.close(), assets.close()]);
        if (results.some((result) => result.status === "rejected")) throw new Error("Relay storage shutdown failed");
      },
    };
  } catch {
    throw new Error("Relay configuration is invalid");
  }
};
