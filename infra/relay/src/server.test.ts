import { expect, test } from "bun:test";

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  // Windows terminates child processes without delivering POSIX shutdown signals.
  test.skipIf(process.platform === "win32")(`${signal} closes the relay and exits successfully`, async () => {
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/server.ts`], {
      env: { ...process.env, RELAY_HOST: "127.0.0.1", RELAY_PORT: "0" },
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
