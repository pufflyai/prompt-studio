import { expect, test } from "bun:test";

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  test.skipIf(process.platform === "win32")(`backup scheduler exits cleanly on ${signal}`, async () => {
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/../backup-server.ts`], {
      env: {
        ...process.env,
        DATABASE_URL: "postgres://idle:idle@127.0.0.1:1/idle",
        S3_BUCKET: "live",
        S3_ENDPOINT: "http://127.0.0.1:1",
        S3_REGION: "us-east-1",
        S3_ACCESS_KEY_ID: "idle",
        S3_SECRET_ACCESS_KEY: "idle",
        BACKUP_S3_BUCKET: "private-backups",
        BACKUP_S3_ENDPOINT: "http://127.0.0.1:1",
        BACKUP_S3_REGION: "us-east-1",
        BACKUP_S3_ACCESS_KEY_ID: "backup-only",
        BACKUP_S3_SECRET_ACCESS_KEY: "backup-only",
        RELAY_BACKUP_PORT: "0",
        RELAY_BACKUP_HOST: "127.0.0.1",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const reader = child.stdout.getReader();
    try {
      let output = "";
      while (!output.includes("\n")) {
        const next = await reader.read();
        if (next.done) throw new Error("Backup scheduler exited before listening");
        output += new TextDecoder().decode(next.value);
      }
      const ready = JSON.parse(output.split("\n")[0]!);
      expect(ready.event).toBe("relay.backup.listening");
      child.kill(signal);
      expect(await child.exited).toBe(0);
    } finally {
      child.kill();
      await child.exited;
      reader.releaseLock();
    }
  });
}
