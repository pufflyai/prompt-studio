import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("container shutdown reaches the foreground runtime so its durable owners can close", async () => {
  const root = await mkdtemp(join(tmpdir(), "device-runtime-stop-"));
  let wrapper: Bun.Subprocess<"ignore", "pipe", "pipe"> | undefined;
  try {
    const defaults = join(root, "defaults");
    await mkdir(join(defaults, "extensions"), { recursive: true });
    const childScript =
      'process.on("SIGTERM", () => { console.log("DURABLE_OWNERS_CLOSED"); process.exit(0); }); console.log(JSON.stringify({args:process.argv.slice(1),home:process.env.PSTDIO_HOME})); setInterval(()=>{},1000);';
    const code = `import {runDevice} from ${JSON.stringify(join(import.meta.dir, "entrypoint.ts"))}; process.exitCode=await runDevice(${JSON.stringify({ home: join(root, "home"), defaults, command: [process.execPath, "-e", childScript, "--"] })});`;
    wrapper = Bun.spawn([process.execPath, "-e", code], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const reader = wrapper.stdout.getReader();
    const first = await reader.read();
    const text = new TextDecoder().decode(first.value);
    expect(text).toContain('"--foreground"');
    expect(text).toContain('"127.0.0.1"');
    expect(text).toContain(join(root, "home"));
    wrapper.kill("SIGTERM");
    let rest = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      rest += new TextDecoder().decode(chunk.value);
    }
    expect(rest).toContain("DURABLE_OWNERS_CLOSED");
    expect(await wrapper.exited).toBe(0);
  } finally {
    if (wrapper?.exitCode === null) {
      wrapper.kill("SIGKILL");
      await wrapper.exited;
    }
    await rm(root, { recursive: true, force: true });
  }
});
