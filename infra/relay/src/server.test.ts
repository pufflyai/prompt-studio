import { expect, test } from "bun:test";

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  // Windows terminates child processes without delivering POSIX shutdown signals.
  test.skipIf(process.platform === "win32")(`${signal} closes the relay and exits successfully`, async () => {
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/server.ts`], {
      // These idle owners never open a connection; real data/authority paths run in Docker.
      env: {
        ...process.env,
        RELAY_HOST: "127.0.0.1",
        RELAY_PORT: "0",
        DATABASE_URL: "postgres://idle:idle@127.0.0.1:1/idle",
        S3_ENDPOINT: "http://127.0.0.1:1",
        S3_BUCKET: "idle",
        S3_REGION: "us-east-1",
        S3_ACCESS_KEY_ID: "idle",
        S3_SECRET_ACCESS_KEY: "idle",
        MANAGER_ORIGIN: "https://manager.example.test",
        MANAGER_SERVICE_SECRET: "idle-service",
        MANAGER_REQUEST_TIMEOUT_MS: "1000",
        RELAY_SUBSCRIPTION_CHECK_INTERVAL_MS: "20",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = child.stdout.getReader();
    const errors = new Response(child.stderr).text();
    try {
      const first = await output.read();
      const ready = new TextDecoder().decode(first.value);
      expect(ready).toContain("Relay listening at http://127.0.0.1:");
      child.kill(signal);
      expect(await child.exited).toBe(0);
      expect(await errors).toBe("");
    } finally {
      child.kill();
      await child.exited;
      output.releaseLock();
    }
  });
}
