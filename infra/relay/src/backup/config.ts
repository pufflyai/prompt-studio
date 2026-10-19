import type { RelayBackupConfig } from "./worker";

export interface RelayBackupServiceConfig extends RelayBackupConfig {
  hostname: string;
  port: number;
}
export const readRelayBackupConfig = (env: Record<string, string | undefined>) => {
  try {
    const required = (name: string) => {
      const value = env[name];
      if (!value) throw new Error("Missing backup configuration");
      return value;
    };
    const store = (prefix: string) => ({
      bucket: required(`${prefix}S3_BUCKET`),
      s3: {
        endpoint: required(`${prefix}S3_ENDPOINT`),
        region: required(`${prefix}S3_REGION`),
        forcePathStyle: true,
        credentials: {
          accessKeyId: required(`${prefix}S3_ACCESS_KEY_ID`),
          secretAccessKey: required(`${prefix}S3_SECRET_ACCESS_KEY`),
        },
      },
    });
    const port = Number(env.RELAY_BACKUP_PORT ?? 8081);
    if (env.RELAY_BACKUP_PORT === "" || !Number.isInteger(port) || port < 0 || port > 65535)
      throw new Error("Invalid backup listener");
    return {
      databaseUrl: required("DATABASE_URL"),
      live: store(""),
      backup: store("BACKUP_"),
      hostname: env.RELAY_BACKUP_HOST ?? "127.0.0.1",
      port,
    } satisfies RelayBackupServiceConfig;
  } catch {
    throw new Error("Relay backup configuration is invalid");
  }
};
