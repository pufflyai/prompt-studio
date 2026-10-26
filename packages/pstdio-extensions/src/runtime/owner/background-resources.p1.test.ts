import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createProcessSampler } from "../process-sampler";
import { createExtensionOwner } from "./supervisor";

test("observes background CPU and owned children after a command returns, and Stop reaps both", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-owner-background-"));
  const owner = createExtensionOwner({ path: root });
  const sampler = await createProcessSampler();
  let childPid: number | undefined;
  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "background",
        publisher: "test",
        main: "extension.ts",
        version: "1.0.0",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(
      join(root, "extension.ts"),
      `export default { commands: [{
      id: 'background', title: 'Background', run: () => {
        const child = Bun.spawn([process.execPath, '-e', 'while (true) {}'], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' });
        setTimeout(() => { while (true) {} }, 10);
        return child.pid;
      }
    }] };`,
    );
    const source = await owner.load();
    childPid = (await source!.definition.commands![0]!.run({} as never, {})) as number;
    let observed = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const state = owner.inspect();
      if (state.resources && state.resources.processes >= 2 && (state.resources.cpuCores ?? 0) > 0) {
        expect(state.pendingCalls).toBe(0);
        expect(state.resources.residentBytes).toBeGreaterThan(0);
        expect(state.resources.windowMs).toBeGreaterThan(0);
        observed = true;
        break;
      }
      await Bun.sleep(10);
    }
    expect(observed).toBe(true);
    await owner.stop();
    for (let attempt = 0; attempt < 100 && (await sampler.read(childPid!)); attempt++) await Bun.sleep(5);
    expect(await sampler.read(childPid!)).toBeNull();
  } finally {
    await owner.dispose();
    if (childPid && (await sampler.read(childPid))) {
      try {
        process.kill(childPid, "SIGKILL");
      } catch {}
    }
    sampler.close();
    await rm(root, { recursive: true, force: true });
  }
});
