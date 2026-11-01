import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installNativeProbeFixture } from "./harness-native-probe-fixture";

test("native harness probes read the current fixture state", async () => {
  const prefix = await mkdtemp(join(tmpdir(), "native-probe Å "));
  try {
    const script = join(prefix, "cli.cjs");
    await Bun.write(script, "console.log('healthy');");
    await installNativeProbeFixture(prefix, "opencode", script);
    const entry = join(prefix, "node_modules", "opencode-ai", "bin", "opencode.exe");
    const healthy = Bun.spawn([entry], { stdout: "pipe", stderr: "pipe" });
    expect(await new Response(healthy.stdout).text()).toBe("healthy\n");
    expect(await healthy.exited).toBe(0);

    await Bun.write(script, "process.exit(7);");
    const broken = Bun.spawn([entry], { stdout: "pipe", stderr: "pipe" });
    expect(await broken.exited).toBe(7);
  } finally {
    await rm(prefix, { recursive: true, force: true });
  }
});
