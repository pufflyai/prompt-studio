import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deserialize } from "node:v8";
import { Worker } from "node:worker_threads";
import { isProcessAlive } from "pstdio-paths";
import { definitionDigest } from "./backend-process/definition-cache";
import { backendWorkerCommand } from "./backend-process/pool";
import { startBackendWorker } from "./backend-process/supervisor";
import { createPreparationClient } from "./preparation-client";
import { createBackendWorkerEnvironment } from "./process-environment";

interface DefinitionData {
  graph: { shared: { value: number }; alias: { value: number }; self: DefinitionData["graph"] };
  date: Date;
  regexp: RegExp;
  bytes: Uint8Array;
  buffer: Uint8Array;
}

const alive = isProcessAlive;

const waitFor = async (ready: () => Promise<boolean>, description: string) => {
  const deadline = Date.now() + 5_000;
  while (!(await ready())) {
    if (Date.now() >= deadline) throw new Error(description);
    await Bun.sleep(10);
  }
};

for (const action of ["cancel", "preempt", "shutdown"] as const) {
  test(`stops a blocked definition reader when preparation must ${action}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "preparation-definition-owner-"));
    const entryPath = join(root, "entry.ts");
    const marker = join(root, "pids");
    const priorHome = process.env.PSTDIO_HOME;
    process.env.PSTDIO_HOME = join(root, "home");
    const launcherMarker = join(root, "launcher.pid");
    const agentMarker = join(root, "agent.pid");
    const launcher = `import {writeFileSync} from "node:fs";
      const agent=Bun.spawn(["/bin/sleep","15"],{detached:true,stdio:["ignore","ignore","ignore"]});
      writeFileSync(${JSON.stringify(agentMarker)},String(agent.pid));
      agent.unref();setTimeout(()=>{},15000);`;
    await writeFile(
      entryPath,
      `import {writeFileSync} from "node:fs";
       ${
         process.platform === "win32"
           ? ""
           : `const launcher=Bun.spawn(${JSON.stringify([process.execPath, "-e", launcher])},
         {detached:true,stdio:["ignore","ignore","ignore"],env:{...process.env,BUN_FEATURE_FLAG_NO_ORPHANS:"0"}});
         writeFileSync(${JSON.stringify(launcherMarker)},String(launcher.pid));launcher.unref();`
       }
       writeFileSync(${JSON.stringify(marker)}, String(process.pid));
       Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);
       export default {commands:[]};`,
    );
    const pids = async () =>
      (
        await Promise.all(
          [marker, launcherMarker, agentMarker].map(async (path) =>
            Number(await readFile(path, "utf8").catch(() => "")),
          ),
        )
      ).filter((pid) => pid > 0);
    const client = createPreparationClient(
      () => new Worker(new URL("./backend-definition-preparation.fixture.ts", import.meta.url)),
      undefined,
      { workers: 1 },
    );
    const controller = new AbortController();
    const pending = client
      .run(
        "definition",
        { entryPath, id: crypto.randomUUID() },
        { priority: "background", resources: ["definition"], signal: controller.signal },
      )
      .catch((error: unknown) => error);
    try {
      await waitFor(
        async () => (await pids()).length === (process.platform === "win32" ? 1 : 3),
        "Definition reader did not enter",
      );
      const owned = await pids();
      for (const pid of owned) expect(alive(pid)).toBe(true);
      if (action === "cancel") {
        controller.abort();
        await pending;
      } else if (action === "preempt") {
        expect(await client.run("value", {}, { resources: ["foreground"] })).toBe("ready");
      } else {
        await client.stop();
      }
      await waitFor(
        async () => owned.every((pid) => !alive(pid)),
        "Definition reader tree survived its preparation owner",
      );
      if (action === "cancel") expect(await client.run("value", {}, { resources: ["foreground"] })).toBe("ready");
    } finally {
      await client.stop();
      await pending;
      // Keep an intentionally failing baseline from leaving its blocked fixture behind.
      for (const pid of await pids()) {
        if (!alive(pid)) continue;
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      }
      if (priorHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = priorHome;
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);
}

test("preparation preserves a definition's data graph and digest for later workers", async () => {
  const root = await mkdtemp(join(tmpdir(), "preparation-definition-data-"));
  const entryPath = join(root, "entry.ts");
  const priorHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const client = createPreparationClient(
    () => new Worker(new URL("./backend-definition-preparation.fixture.ts", import.meta.url)),
  );
  let worker: Awaited<ReturnType<typeof startBackendWorker>> | undefined;
  try {
    await writeFile(
      entryPath,
      `const shared={value:42}; const graph={shared,alias:shared};graph.self=graph;
      export default {graph,date:new Date("2026-01-01T00:00:00Z"),regexp:/reader/gi,
        bytes:new Uint8Array([1,2,3]),buffer:Buffer.from([4,5,6]),run(){return "ok";}};`,
    );
    const inspected = (await client.run("inspect", { entryPath, id: crypto.randomUUID() })) as {
      data: Uint8Array;
      digest: string;
    };
    worker = await startBackendWorker({
      command: backendWorkerCommand(),
      env: createBackendWorkerEnvironment(),
      entryPath,
    });
    expect(inspected.digest).toBe(definitionDigest(worker.definition));
    const data = deserialize(inspected.data) as DefinitionData;
    expect(definitionDigest(data)).toBe(inspected.digest);
    expect(data.graph.self).toBe(data.graph);
    expect(data.graph.shared).toBe(data.graph.alias);
    expect(data.date).toBeInstanceOf(Date);
    expect(data.date.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(data.regexp).toBeInstanceOf(RegExp);
    expect(data.regexp.flags).toBe("gi");
    expect(data.bytes).toBeInstanceOf(Uint8Array);
    expect([...data.bytes]).toEqual([1, 2, 3]);
    expect(data.buffer.constructor).toBe((worker.definition as DefinitionData).buffer.constructor);
    expect([...data.buffer]).toEqual([4, 5, 6]);
  } finally {
    await client.stop();
    await worker?.stop();
    if (priorHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = priorHome;
    await rm(root, { recursive: true, force: true });
  }
}, 15000);
