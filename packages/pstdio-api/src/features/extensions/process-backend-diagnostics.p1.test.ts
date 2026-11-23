import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { closeBackendWorkers } from "pstdio-extensions";
import { createTestApp } from "../../test-utils/create-test-app";

let root: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let projectId: string;
const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };

const command = (id: string, run: string) =>
  `{ id: ${JSON.stringify(id)}, ref: { kind: "command", id: ${JSON.stringify(id)} }, title: ${JSON.stringify(id)}, ${run} }`;

// The same handlers run under a first-party id and under an unknown publisher.
const entry = `
const codeOf = (promise) => promise.then(() => "resolved", (error) => error.code ?? error.message);
export default {
  commands: [
    ${command(
      "cpu",
      `async run(ctx) {
        const capturing = ctx.diagnostics.capture({ kind: "cpu", durationMs: 300, signal: ctx.signal });
        await new Promise((resolve) => setTimeout(resolve, 50));
        await ctx.storage.set("probe", 1);
        const result = await capturing;
        return {
          workerPid: process.pid,
          pid: result.data.pid,
          nodes: result.data.profile.nodes.length,
          unit: result.summary.unit,
          kinds: result.data.operations.events.map((event) => event.kind),
        };
      }`,
    )},
    ${command(
      "coverage",
      `async run(ctx) {
        const result = await ctx.diagnostics.capture({ kind: "coverage", durationMs: 50 });
        return { unit: result.summary.unit, total: result.summary.total };
      }`,
    )},
    ${command(
      "armed",
      `async run(ctx) {
        const checkpoints = [];
        const result = await ctx.diagnostics.capture({
          kind: "armed",
          durationMs: 10000,
          cpuPercent: 0.01,
          checkpoint: async (data) => { checkpoints.push({ complete: data.complete, pid: data.pid }); },
        });
        return { checkpoints, reason: result.data.reason, profiles: result.data.profiles.length };
      }`,
    )},
    ${command(
      "overlap",
      `async run(ctx) {
        const controller = new AbortController();
        const first = codeOf(ctx.diagnostics.capture({ kind: "cpu", durationMs: 60000, signal: controller.signal }));
        await new Promise((resolve) => setTimeout(resolve, 50));
        const second = await codeOf(ctx.diagnostics.capture({ kind: "coverage", durationMs: 20 }));
        const cancelledAt = performance.now();
        controller.abort();
        const cancelled = await first;
        const stoppedWithinMs = performance.now() - cancelledAt;
        const after = await ctx.diagnostics.capture({ kind: "cpu", durationMs: 20 });
        return { second, cancelled, stoppedWithinMs, afterNodes: after.data.profile.nodes.length };
      }`,
    )},
    ${command("refused", `run: (ctx) => codeOf(ctx.diagnostics.capture({ kind: "cpu", durationMs: 20 }))`)},
  ],
};
`;

const install = async (publisher: string, name: string) => {
  const source = join(root, `${publisher}-${name}`);
  await mkdir(source);
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      publisher,
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  await writeFile(join(source, "extension.ts"), entry);
  await handle.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    installName: name,
    extensionId: `${publisher}.${name}`,
    name,
    displayName: name,
    sourcePath: source,
    sourceKind: "local_path",
    manifest: {},
  });
};

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "process-diagnostics-"));
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  projectId = (await handle.deps.projectService.create({ name: "Diagnostics" })).id;
  const folder = join(root, "project");
  await mkdir(folder);
  await handle.deps.workspaceService.ensureDefault({
    project_id: projectId,
    root_path: folder,
    name: "Project folder",
  });
  await install("pstdio", "performance");
  await install("example", "profiler");
});

afterAll(async () => {
  await handle?.close();
  await closeBackendWorkers();
  process.env.PSTDIO_HOME = previous.home;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
  await rm(root, { recursive: true, force: true });
});

const execute = async (extensionId: string, name: string) => {
  const response = await handle.app.request(
    `/v1/projects/${projectId}/extensions/commands/${extensionId}.command.${name}/execute`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ params: {} }) },
  );
  const { outcome } = (await response.json()) as { outcome: { ok: boolean; value: unknown } };
  expect(outcome).toMatchObject({ ok: true });
  return outcome.value as Record<string, unknown>;
};

test("a process-mode command profiles the API process, not its worker, and sees API operations", async () => {
  const value = await execute("pstdio.performance", "cpu");
  expect(value.workerPid).not.toBe(process.pid);
  expect(value.pid).toBe(process.pid);
  expect(value.nodes).toBeGreaterThan(0);
  expect(value.unit).toBe("samples");
  expect(value.kinds).toContain("database.query");
});

test("a process-mode coverage capture counts API function calls", async () => {
  expect(await execute("pstdio.performance", "coverage")).toMatchObject({ unit: "calls" });
});

test("an armed capture calls the worker's checkpoint callback", async () => {
  const value = await execute("pstdio.performance", "armed");
  expect(value.reason).toBe("threshold");
  expect(value.profiles).toBe(1);
  expect(value.checkpoints).toEqual([{ complete: true, pid: process.pid }]);
}, 15_000);

test("a second concurrent capture is refused and the worker's signal stops the first", async () => {
  const value = await execute("pstdio.performance", "overlap");
  expect(value.second).toBe("diagnostics_busy");
  expect(value.cancelled).not.toBe("resolved");
  expect(value.stoppedWithinMs).toBeLessThan(1000);
  expect(value.afterNodes).toBeGreaterThan(0);
});

test("an extension outside the first-party catalog is refused", async () => {
  expect((await execute("example.profiler", "refused")) as unknown).toBe("diagnostics_forbidden");
});
