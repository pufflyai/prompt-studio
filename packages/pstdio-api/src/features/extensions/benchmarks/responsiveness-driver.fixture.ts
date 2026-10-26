import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { availableParallelism, cpus, freemem, platform, release, totalmem } from "node:os";
import { join, resolve } from "node:path";
import type { CompilerObservation } from "../extension-compiler-observations";
import { fixtureVersion } from "./responsiveness-fixtures.fixture";

export type MeasurementMode = "inline" | "owner";
interface Ready {
  url: string;
  projectId: string;
  pid: number;
}
interface HostStats {
  eventLoop: { resolutionMs: number; p95Ms: number; maxMs: number };
  compilers: CompilerObservation[];
  apiRssBytes: number;
  leakedPreparationPid?: number;
}
export const startResponsivenessHost = async (root: string, mode: MeasurementMode, builds: boolean) => {
  mkdirSync(root, { recursive: true });
  const ready = Promise.withResolvers<Ready>();
  const pending = new Map<number, ReturnType<typeof Promise.withResolvers<HostStats>>>();
  const compilerEvents: CompilerObservation[] = [];
  let sequence = 0;
  const child = Bun.spawn(
    [
      process.execPath,
      "--conditions=source",
      join(import.meta.dir, "responsiveness-host.fixture.ts"),
      root,
      builds ? "builds" : "commands",
    ],
    {
      env: {
        ...process.env,
        PSTDIO_HOME: join(root, "home"),
        PSTDIO_DEFAULT_EXTENSIONS: "[]",
        PSTDIO_EXTENSION_WEBVIEW_BUILDS: builds ? "1" : "0",
        PSTDIO_EXTENSION_PROCESS_OWNERS: mode === "owner" ? "1" : "0",
      },
      stdin: "ignore",
      stdout: Bun.file(join(root, "host.stdout.log")),
      stderr: Bun.file(join(root, "host.stderr.log")),
      serialization: "json",
      ipc: (message) => {
        if (message.kind === "ready") ready.resolve(message);
        if (message.kind === "compiler") compilerEvents.push(message.event);
        if (message.kind !== "reply") return;
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) waiter?.reject(new Error(message.error));
        else waiter?.resolve(message.value);
      },
    },
  );
  const exited = child.exited.then((code) => {
    const error = new Error(`Benchmark host exited (${code}); see ${join(root, "host.stderr.log")}`);
    ready.reject(error);
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  });
  const control = (kind: string) => {
    const request = Promise.withResolvers<HostStats>();
    const id = ++sequence;
    pending.set(id, request);
    child.send({ kind, id });
    return request.promise;
  };
  let address: Ready;
  try {
    address = await ready.promise;
  } catch (error) {
    await exited;
    throw error;
  }
  const request = (path: string, body?: unknown, signal?: AbortSignal) =>
    fetch(`${address.url}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  const json = async (path: string, body?: unknown) => {
    const response = await request(path, body);
    const value = await response.json();
    if (!response.ok) throw new Error(`Benchmark request failed (${response.status}): ${path}`);
    return value;
  };
  const commandPath = (name: string, command: string) =>
    `/v1/projects/${address.projectId}/extensions/commands/test.${name}.command.${command}/execute`;
  const probes = {
    health: () => request("/healthz"),
    projects: () => request("/v1/projects"),
    command: () => request(commandPath("probe", "ping"), {}),
  };
  return {
    ...address,
    root,
    mode,
    request,
    json,
    commandPath,
    probes,
    control,
    compilerEvents,
    close: async () => {
      const result = await control("close");
      await waitFor(() => child.exitCode !== null, "benchmark host shutdown");
      await exited;
      if (result.leakedPreparationPid !== undefined)
        throw new Error("Application shutdown left a preparation process alive");
    },
  };
};

const readable = (path: string) => {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
};
export const measurementMetadata = async () => {
  const revision = Bun.spawnSync(["git", "rev-parse", "HEAD"]);
  const dirty = Bun.spawnSync(["git", "status", "--porcelain"]);
  const fixtureFiles = [
    "responsiveness-fixtures.fixture.ts",
    "responsiveness-samples.ts",
    "responsiveness-driver.fixture.ts",
    "responsiveness-host.fixture.ts",
    "extension-isolation.p3.bench.ts",
    "extension-builds.p3.bench.ts",
  ];
  const checksum = createHash("sha256");
  for (const name of fixtureFiles) checksum.update(name).update(readFileSync(join(import.meta.dir, name)));
  return {
    fixtureVersion,
    fixtureSha256: checksum.digest("hex"),
    revision: revision.stdout.toString().trim(),
    dirty: dirty.stdout.length > 0,
    bun: Bun.version,
    os: platform(),
    osRelease: release(),
    architecture: process.arch,
    cpuModel: cpus()[0]?.model,
    availableParallelism: availableParallelism(),
    totalMemoryBytes: totalmem(),
    freeMemoryBytes: freemem(),
    cgroupCpuMax: readable("/sys/fs/cgroup/cpu.max"),
    cgroupMemoryMax: readable("/sys/fs/cgroup/memory.max"),
    cgroupMemoryCurrent: readable("/sys/fs/cgroup/memory.current"),
    affinity:
      readable("/proc/self/status")
        ?.split("\n")
        .find((line) => line.startsWith("Cpus_allowed_list:")) ?? null,
    lockSha256: createHash("sha256")
      .update(readFileSync(resolve(import.meta.dir, "../../../../../../bun.lock")))
      .digest("hex"),
    probePolicy: { inFlightPerOperation: 1, pauseAfterResponseMs: 20, retainResponsesFinishingAfterWork: true },
    comparison:
      "Inline callbacks and preparation versus opt-in subprocess owners and trusted preparation subprocess. Both use production loaders, hashes, graph scanning and compilers. Compiler ceiling remains max(1,min(4,availableParallelism())).",
    referenceGate:
      "Record only on this host. The proposed release gate requires Linux, four available CPUs, a four-CPU cgroup quota and 16 GiB memory limit; native platform baselines remain required.",
  };
};

export const waitFor = async (condition: () => boolean | Promise<boolean>, label: string) => {
  const start = performance.now();
  while (!(await condition())) {
    if (performance.now() - start > 30_000) throw new Error(`Benchmark phase did not finish: ${label}`);
    await Bun.sleep(5);
  }
};

export const benchmarkOutput = (kind: string) =>
  resolve(
    process.env.PSTDIO_PERF_OUTPUT ??
      resolve(import.meta.dir, "../../../../../../test-results/extension-responsiveness"),
    kind,
  );
