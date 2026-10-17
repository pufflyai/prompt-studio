import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  // Windows terminates child processes without delivering POSIX shutdown signals.
  test.skipIf(process.platform === "win32")(`${signal} closes the relay and exits successfully`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "relay-public-trust-"));
    const key = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair;
    const trustFile = join(directory, "trust.json");
    const recoveryFile = join(directory, "recovery-key");
    await writeFile(recoveryFile, crypto.getRandomValues(new Uint8Array(32)), { mode: 0o600 });
    const publicKey = await crypto.subtle.exportKey("jwk", key.publicKey);
    await writeFile(
      trustFile,
      JSON.stringify({
        issuer: "https://manager.fixture.test",
        audience: "https://relay.fixture.test",
        jwks: { keys: [{ kty: publicKey.kty, crv: publicKey.crv, x: publicKey.x, kid: "owned" }] },
      }),
    );
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
        RELAY_ACCESS_TRUST_FILE: trustFile,
        RELAY_RECOVERY_KEY_FILE: recoveryFile,
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
      await rm(directory, { recursive: true, force: true });
    }
  });
}
