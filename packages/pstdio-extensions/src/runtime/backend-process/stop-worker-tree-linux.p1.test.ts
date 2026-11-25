import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stopBackendWorkerTree } from "./stop-worker-tree";

const readLeader = async (pid: number) => {
  try {
    const stat = await Bun.file(`/proc/${pid}/stat`).text();
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return { state: fields[0], threads: Number(fields[17]) };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ESRCH") throw error;
    return { state: undefined, threads: 0 };
  }
};

const killIfPresent = (pid: number) => {
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
};

const supportsThreadFixture = () => {
  if (process.platform !== "linux") return false;
  const { header } = process.report.getReport() as { header: { glibcVersionRuntime?: string } };
  return !!header.glibcVersionRuntime;
};

test.skipIf(!supportsThreadFixture())("a zombie agent leader with a live Linux thread is stopped", async () => {
  const root = await mkdtemp(join(tmpdir(), "backend-agent-threads-"));
  const agentPath = join(root, "agent.ts");
  const threadPath = join(root, "thread.ts");
  const pidPath = join(root, "agent.pid");
  // SYS_exit ends just the calling thread, preserving the live sibling in the same process.
  const exitThread = process.arch === "arm64" ? 93 : 60;
  let worker: Bun.Subprocess | undefined;
  let agentPid = 0;
  try {
    await Promise.all([
      writeFile(
        threadPath,
        'import { parentPort } from "node:worker_threads"; parentPort.postMessage("started"); setInterval(() => {}, 1000);',
      ),
      writeFile(
        agentPath,
        `import { dlopen } from "bun:ffi";
         import { Worker } from "node:worker_threads";
         const libc = dlopen("libc.so.6", { syscall: { args: ["i64", "i64"], returns: "i64" } });
         const sibling = new Worker(${JSON.stringify(threadPath)});
         sibling.once("message", () => libc.symbols.syscall(${exitThread}n, 0n));`,
      ),
    ]);
    worker = Bun.spawn(
      [
        process.execPath,
        "-e",
        `const agent = Bun.spawn([process.execPath, ${JSON.stringify(agentPath)}], {
           detached: true, stdio: ["ignore", "ignore", "inherit"],
         });
         await Bun.write(${JSON.stringify(pidPath)}, String(agent.pid));
         setInterval(() => {}, 1000);`,
      ],
      { detached: true, stdio: ["ignore", "ignore", "inherit"] },
    );
    let before: Awaited<ReturnType<typeof readLeader>> | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (!agentPid && (await Bun.file(pidPath).exists())) agentPid = Number(await Bun.file(pidPath).text());
      if (agentPid) before = await readLeader(agentPid);
      if (before?.state === "Z" && before.threads > 1) break;
      await Bun.sleep(10);
    }
    expect(before?.state).toBe("Z");
    expect(before?.threads).toBeGreaterThan(1);
    await stopBackendWorkerTree(worker, 2_000);
    const after = await readLeader(agentPid);
    expect(after.state === undefined || (/^[ZX]$/.test(after.state) && after.threads === 1)).toBe(true);
  } finally {
    if (agentPid) killIfPresent(agentPid);
    worker?.kill("SIGKILL");
    await worker?.exited;
    await rm(root, { recursive: true, force: true });
  }
});
