import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext, HarnessDetectionResult, HarnessSession } from "pstdio-api-contracts/extension-kernel";
import {
  backendWorkerCommand,
  createExtensionProcessEnvironment,
  HANDLER_MARKER,
  type RuntimeHarnessRecord,
  startBackendWorker,
} from "pstdio-extensions";
import { isProcessAlive } from "pstdio-paths";
import { createHarnessRegistryService } from "./harness-registry-service";
import { createTestHarnessRecord } from "./test-harness-registry";

const fixture = `
const start = async (ctx, input) => {
  const pending = ctx.process.run(input);
  pending.catch(() => {});
  while (!(await Bun.file(input.marker).exists())) await Bun.sleep(10);
  return { pending };
};
export default {
  live: async (ctx, input, probe) => {
    const { pending } = await start(ctx, input);
    return {
      done: pending.then(() => ({ status: "completed" }), () => ({ status: "failed" })),
      stop: async () => { await ctx.process.run(probe); },
    };
  },
  settled: async (ctx, input) => {
    await start(ctx, input);
    return { available: true };
  },
  probe: async (ctx, input, method) => {
    await ctx.process[method](input);
    return { available: true };
  },
  stuck: async (ctx, input) => {
    await start(ctx, input);
    while (true);
  },
};
`;

const waitFor = async <T>(description: string, check: () => T | Promise<T>) => {
  const deadline = performance.now() + 2_000;
  do {
    const value = await check();
    if (value) return value;
    await Bun.sleep(20);
  } while (performance.now() < deadline);
  throw new Error(`Timed out waiting for ${description}`);
};

const invoke = (
  worker: Awaited<ReturnType<typeof startBackendWorker>>,
  handler: string,
  context: HarnessContext,
  args: unknown[],
) =>
  worker.invoke({
    handlerId: (worker.definition as Record<string, { [HANDLER_MARKER]: string }>)[handler][HANDLER_MARKER],
    context,
    surface: {
      kind: "object",
      members: { process: { kind: "object", members: { run: { kind: "async" }, runOrThrow: { kind: "async" } } } },
    },
    args,
  });

const createFixtureRegistry = (record: RuntimeHarnessRecord) =>
  createHarnessRegistryService({
    installedExtensionSourcesService: { list: async () => [] } as never,
    extensionRuntimeCatalog: {
      get: async () => ({ runtime: { harnesses: [record] } }) as never,
      getSourcesRuntime: async () => {
        throw new Error("Fixture uses a project harness.");
      },
      subscribeInvalidation: () => () => {},
    },
  });

const childInput = (root: string, release: string, name: string) => {
  const marker = join(root, name);
  return {
    marker,
    command: [
      process.execPath,
      "-e",
      `import { writeFileSync, renameSync, existsSync } from "node:fs";
      const marker = ${JSON.stringify(marker)};
      writeFileSync(marker + ".tmp", String(process.pid));
      renameSync(marker + ".tmp", marker);
      const end = performance.now() + 8000;
      const timer = setInterval(() => {
        if (performance.now() > end || existsSync(${JSON.stringify(release)})) clearInterval(timer);
      }, 20);`,
    ],
  };
};

test("harness worker calls own their host processes across settlement and watchdog shutdown", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-harness-host-process-"));
  const entryPath = join(root, "extension.ts");
  const release = join(root, "release");
  await writeFile(entryPath, fixture);
  const liveInput = childInput(root, release, "live");
  const settledInput = childInput(root, release, "settled");
  const stuckInput = childInput(root, release, "stuck");
  const probe = join(root, "probe");
  const readPid = (marker: string) =>
    waitFor(marker, async () => Number(await readFile(marker, "utf8").catch(() => "")));

  let worker: Awaited<ReturnType<typeof startBackendWorker>> | undefined;
  let service: ReturnType<typeof createHarnessRegistryService> | undefined;
  try {
    worker = await startBackendWorker({
      command: backendWorkerCommand(),
      env: createExtensionProcessEnvironment(),
      entryPath,
      watchdog: { heartbeatMs: 50, unresponsiveMs: 900 },
    });
    const active = worker;
    const record = createTestHarnessRecord("host-process", {
      provider: {
        start: async (context) =>
          (await invoke(active, "live", context, [
            liveInput,
            {
              command: [process.execPath, "-e", `await Bun.write(${JSON.stringify(probe)}, "alive");`],
            },
          ])) as HarnessSession,
        detect: async (context) => (await invoke(active, "settled", context, [settledInput])) as HarnessDetectionResult,
        capabilities: async (context) => {
          await invoke(active, "stuck", context, [stuckInput]);
          return [];
        },
      },
    });
    service = createFixtureRegistry(record);
    const options = { projectId: "project" };
    const harness = (await service.get(record.id, options))!;
    const live = await harness.start(
      {
        sessionId: "session",
        prompt: "run",
        events: { push: () => {}, getMessages: () => [] },
      },
      options,
    );
    const livePid = await readPid(liveInput.marker);
    expect(await harness.detect(options)).toEqual({ available: true });
    const settledPid = await readPid(settledInput.marker);
    await waitFor("the process from the settled call to exit", () => !isProcessAlive(settledPid));

    expect(isProcessAlive(livePid)).toBe(true);
    await live.stop();
    expect(await readFile(probe, "utf8")).toBe("alive");

    const stopped = harness.capabilities(options);
    void stopped.catch(() => {});
    const stuckPid = await readPid(stuckInput.marker);
    await expect(stopped).rejects.toThrow("did not respond");
    await active.exited;
    expect(isProcessAlive(stuckPid)).toBe(false);
    expect(isProcessAlive(livePid)).toBe(false);
    expect(await live.done).toMatchObject({ status: "failed" });
  } finally {
    await writeFile(release, "");
    try {
      await worker?.stop();
      await service?.dispose();
      for (const { marker } of [liveInput, settledInput, stuckInput]) {
        const pid = Number(await readFile(marker, "utf8").catch(() => ""));
        if (pid) await waitFor("fixture child cleanup", () => !isProcessAlive(pid));
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}, 12_000);

test.each([
  "run",
  "runOrThrow",
] as const)("harness detection joins its worker's %s probe at the deadline", async (method) => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-harness-detection-worker-"));
  const entryPath = join(root, "extension.ts");
  const release = join(root, "release");
  const input = childInput(root, release, "probe");
  let worker: Awaited<ReturnType<typeof startBackendWorker>> | undefined;
  let service: ReturnType<typeof createHarnessRegistryService> | undefined;
  try {
    await writeFile(entryPath, fixture);
    const active = await startBackendWorker({
      command: backendWorkerCommand(),
      env: createExtensionProcessEnvironment(),
      entryPath,
    });
    worker = active;
    const record = createTestHarnessRecord("detection-deadline", {
      provider: {
        detect: async (context) => (await invoke(active, "probe", context, [input, method])) as HarnessDetectionResult,
      },
    });
    service = createFixtureRegistry(record);
    const options = { projectId: "project" };
    const harness = (await service.get(record.id, options))!;
    const result = await harness.detect(options);
    const pid = Number(await readFile(input.marker, "utf8"));
    expect(pid).toBeGreaterThan(0);
    expect(result.available).toBe(false);
    expect(isProcessAlive(pid)).toBe(false);
  } finally {
    await writeFile(release, "");
    try {
      await worker?.stop();
      await service?.dispose();
      const pid = Number(await readFile(input.marker, "utf8").catch(() => ""));
      if (pid) await waitFor("fixture child cleanup", () => !isProcessAlive(pid));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}, 12_000);
