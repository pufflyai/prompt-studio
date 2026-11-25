import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isProcessAlive } from "pstdio-paths";
import { preparationHostIdentity } from "../prepared-revision";
import { createExtensionProcessEnvironment } from "../process-environment";
import { closeBackendWorkers, loadBackendDefinition, restartBackendWorker } from "./backend-workers";
import { createBackendWorkerPool } from "./pool";
import { HANDLER_MARKER } from "./protocol";
import type { BackendWorker } from "./supervisor";

const roots: string[] = [];
let previousHome: string | undefined;
afterEach(async () => {
  await closeBackendWorkers();
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "backend-generations-"));
  roots.push(root);
  previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const revision = async (id: string, definition = "export default { next: () => ++calls };") => {
    const entryPath = join(root, `${id}.ts`);
    await writeFile(entryPath, `let calls = 0; ${definition}`);
    return { id, entryPath, host: preparationHostIdentity(), manifest: { id: "example.backend-generations" } };
  };
  return { root, revision };
};

const next = async (loaded: Awaited<ReturnType<typeof loadBackendDefinition>>) => {
  const definition = loaded.definition as { next: { [HANDLER_MARKER]: string } };
  const worker = await loaded.acquire();
  return worker.invoke({
    handlerId: definition.next[HANDLER_MARKER],
    context: {},
    surface: { kind: "object", members: {} },
    args: [],
  });
};

test("an unused candidate leaves the active worker running until a new generation is used", async () => {
  const { root, revision } = await fixture();
  const active = await loadBackendDefinition(root, await revision("active"));
  expect(await next(active)).toBe(1);
  const oldWorker = await active.acquire();
  const candidate = await loadBackendDefinition(root, await revision("candidate"));
  expect(await active.acquire()).toBe(oldWorker);
  expect(await next(active)).toBe(2);
  expect(await next(candidate)).toBe(1);
  await oldWorker.exited;
  const stale = await active.acquire().catch((error) => error);
  expect(stale).toMatchObject({ code: "backend_unavailable" });
});

test("a different folder keeps its shared worker when the first folder adopts a new generation", async () => {
  const { root, revision } = await fixture();
  const shared = await revision("shared");
  const first = await loadBackendDefinition(join(root, "first"), shared);
  const second = await loadBackendDefinition(join(root, "second"), shared);
  expect(await next(first)).toBe(1);
  expect(await next(second)).toBe(2);
  const candidate = await loadBackendDefinition(join(root, "first"), await revision("candidate"));
  expect(await next(candidate)).toBe(1);
  expect(await next(second)).toBe(3);
  const stale = await first.acquire().catch((error) => error);
  expect(stale).toMatchObject({ code: "backend_unavailable" });
});

test("reloading unchanged source starts it fresh without restarting a worker another folder uses", async () => {
  const { root, revision } = await fixture();
  const shared = await revision("shared");
  const firstPath = join(root, "first");
  const first = await loadBackendDefinition(firstPath, shared);
  const second = await loadBackendDefinition(join(root, "second"), shared);
  expect(await next(first)).toBe(1);
  expect(await next(second)).toBe(2);
  const sharedWorker = await second.acquire();
  expect(await first.acquire()).toBe(sharedWorker);

  await restartBackendWorker(firstPath, shared);
  expect(await next(second)).toBe(3);
  expect(await second.acquire()).toBe(sharedWorker);
  expect(await next(first)).toBe(1);
  const reloadedWorker = await first.acquire();
  expect(reloadedWorker).not.toBe(sharedWorker);

  const replacement = await loadBackendDefinition(firstPath, await revision("replacement"));
  expect(await next(replacement)).toBe(1);
  await reloadedWorker.exited;
  expect(await next(second)).toBe(4);
});

test("a shared worker starting during reload cannot answer for the reloaded folder", async () => {
  const { root, revision } = await fixture();
  const gate = join(root, "hold-worker");
  const entered = join(root, "worker-starting");
  const shared = await revision(
    "shared",
    `
    import { existsSync } from "node:fs";
    if (existsSync(${JSON.stringify(gate)})) {
      await Bun.write(${JSON.stringify(entered)}, "");
      while (existsSync(${JSON.stringify(gate)})) await Bun.sleep(10);
    }
    export default { next: () => ++calls };
    `,
  );
  const firstPath = join(root, "first");
  const first = await loadBackendDefinition(firstPath, shared);
  const second = await loadBackendDefinition(join(root, "second"), shared);
  expect(await next(first)).toBe(1);
  expect(await next(second)).toBe(2);
  await (await first.acquire()).stop();

  await writeFile(gate, "");
  const stale = first.acquire().catch((error: unknown) => error);
  try {
    for (let attempt = 0; !(await Bun.file(entered).exists()) && attempt < 100; attempt++) await Bun.sleep(10);
    expect(await Bun.file(entered).exists()).toBe(true);
    await restartBackendWorker(firstPath, shared);
  } finally {
    await rm(gate, { force: true });
  }
  expect(await stale).toMatchObject({ code: "backend_unavailable" });
  expect(await next(second)).toBe(1);
  expect(await next(first)).toBe(1);
});

test("queued and retained handlers start no worker during or after a shared shutdown", async () => {
  const { root, revision } = await fixture();
  const active = await loadBackendDefinition(root, await revision("active"));
  await next(active);
  const worker = await active.acquire();
  const candidate = await loadBackendDefinition(root, await revision("candidate"));
  const queued = candidate.acquire().catch((error) => error);
  const closing = closeBackendWorkers();
  expect(closeBackendWorkers()).toBe(closing);
  await closing;
  await worker.exited;
  expect(await queued).toMatchObject({ code: "backend_unavailable" });
  const stale = await active.acquire().catch((error) => error);
  expect(stale).toMatchObject({ code: "backend_unavailable" });
});

test("a restarted worker cannot answer for a different handler definition", async () => {
  const { root, revision } = await fixture();
  const marker = join(root, "reordered");
  const source = await revision(
    "active",
    `
    import { existsSync } from "node:fs";
    const next = () => ++calls;
    const other = () => "other handler";
    export default existsSync(${JSON.stringify(marker)}) ? { other, next } : { next, other };
  `,
  );
  const active = await loadBackendDefinition(root, source);
  expect(await next(active)).toBe(1);
  await (await active.acquire()).stop();
  await writeFile(marker, "");
  const failure = await next(active).catch((error) => error);
  expect(failure).toMatchObject({ code: "backend_unavailable", message: expect.stringContaining("definition") });
});

const stopOutcomes = ["pending cleanup", "bounded rejection"] as const;
test.skipIf(process.platform === "win32").each(stopOutcomes)("pool close sees %s after replacement", async (mode) => {
  const { revision } = await fixture();
  const { entryPath } = await revision(
    "watchdog",
    "export default { pid: () => process.pid, hang() { while (true); } };",
  );
  const pool = createBackendWorkerPool(() => ({
    entryPath,
    env: createExtensionProcessEnvironment(),
    watchdog: { heartbeatMs: 20, unresponsiveMs: 500 },
  }));
  const invoke = (worker: BackendWorker, handler: "pid" | "hang") => {
    const definition = worker.definition as Record<typeof handler, { [HANDLER_MARKER]: string }>;
    return worker.invoke({
      handlerId: definition[handler][HANDLER_MARKER],
      context: {},
      surface: { kind: "object", members: {} },
      args: [],
    });
  };
  const failed = await pool.acquire("same");
  const failedPid = (await invoke(failed, "pid")) as number;
  const nativeKill = process.kill.bind(process);
  const cleanupStarted = Promise.withResolvers<void>();
  const holdCleanup = spyOn(process, "kill").mockImplementation((pid, signal) => {
    if (pid === -failedPid && signal === "SIGKILL") {
      cleanupStarted.resolve();
      return true;
    }
    return nativeKill(pid, signal);
  });
  try {
    await expect(invoke(failed, "hang")).rejects.toThrow("did not respond");
    await cleanupStarted.promise;
    const replacement = await pool.acquire("same");
    expect(replacement).not.toBe(failed);
    const closing = pool.close();
    const closeResult = closing.catch((error: unknown) => error);
    await replacement.exited;
    if (mode === "bounded rejection") {
      const stopFailure = await failed.stop().catch((error: unknown) => error);
      expect(stopFailure).toBeInstanceOf(Error);
      expect(isProcessAlive(failedPid)).toBe(true);
      const result = await Promise.race([closeResult, Bun.sleep(20).then(() => "pool.close is still pending")]);
      expect(result).toBe(stopFailure);
      return;
    }
    const closedEarly = await Promise.race([closing.then(() => true), Bun.sleep(20).then(() => false)]);
    expect(closedEarly).toBe(false);
    expect(isProcessAlive(failedPid)).toBe(true);
    nativeKill(-failedPid, "SIGKILL");
    await closing;
    expect(isProcessAlive(failedPid)).toBe(false);
  } finally {
    holdCleanup.mockRestore();
    if (isProcessAlive(failedPid)) nativeKill(-failedPid, "SIGKILL");
    await Promise.allSettled([failed.exited, pool.close()]);
  }
});
