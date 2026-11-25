import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { closeBackendWorkers, prepareExtensionRevision, uncoveredContextFunctions } from "pstdio-extensions";
import { createTestApp } from "../../test-utils/create-test-app";

let root: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let projectId: string;
const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };

const entry = `
const item = (ctx) => ctx.storage.collection("items");
export default {
  harnesses: [{ id: "agent" }],
  middlewares: [
    {
      id: "shout",
      ref: { kind: "middleware", id: "shout" },
      command: { kind: "command", id: "save" },
      run: (ctx, params) => ctx.commands.patchParams({ text: String(params.text ?? "").toUpperCase() }),
    },
  ],
  hooks: [
    {
      id: "on-saved",
      ref: { kind: "hook", id: "on-saved" },
      event: { kind: "event", id: "command.completed:save" },
      async run(ctx) {
        await item(ctx).put("hooked", { pid: process.pid });
      },
    },
  ],
  commands: [
    {
      id: "workspace-files",
      ref: { kind: "command", id: "workspace-files" },
      title: "Workspace files",
      run: (ctx) => ctx.workspaceFiles ? "present" : "absent",
    },
    {
      id: "navigate",
      ref: { kind: "command", id: "navigate" },
      title: "Navigate",
      run(ctx) {
        ctx.navigation.open({ kind: "invalid" });
        return "ignored";
      },
    },
    {
      id: "save",
      ref: { kind: "command", id: "save" },
      title: "Save",
      async run(ctx, params) {
        await item(ctx).put(params.id, { text: params.text });
        ctx.logger.info("saved");
        return { pid: process.pid, stored: await item(ctx).get(params.id), id: ctx.storage.records.id(params.id) };
      },
    },
    {
      id: "reject-stale",
      ref: { kind: "command", id: "reject-stale" },
      title: "Reject stale",
      run(ctx) {
        const rejection = ctx.commands.reject({
          code: "stale_revision",
          reason: "Version changed",
          data: { expectedRevision: 1, actualRevision: 2 },
          cause: { code: "concurrent_save" },
          error: { message: "Changed", cause: { source: "storage" } },
          notices: [{ type: "warning", message: "Reload" }],
          diagnostics: [{ code: "conflict", message: "Revision changed", severity: "warning" }],
        });
        throw new Error("Version changed", { cause: rejection });
      },
    },
    {
      id: "read-hooked",
      ref: { kind: "command", id: "read-hooked" },
      title: "Read hooked",
      run: (ctx) => item(ctx).get("hooked"),
    },
    { id: "crash", ref: { kind: "command", id: "crash" }, title: "Crash", run: () => process.exit(1) },
    {
      id: "port",
      ref: { kind: "command", id: "port" },
      title: "Port",
      run: (ctx) => ctx.net.findFreePort(),
    },
    {
      id: "spin",
      ref: { kind: "command", id: "spin" },
      title: "Spin",
      run() {
        const until = Date.now() + 1500;
        while (Date.now() < until);
        return "spun";
      },
    },
  ],
};
`;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "process-backend-"));
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const source = join(root, "isolated");
  await mkdir(source);
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name: "isolated",
      version: "1.0.0",
      publisher: "example",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      pstdio: { backendRuntime: "process" },
    }),
  );
  await writeFile(join(source, "extension.ts"), entry);
  const inProcess = join(root, "in-process");
  await mkdir(inProcess);
  await writeFile(
    join(inProcess, "package.json"),
    JSON.stringify({
      name: "in-process",
      version: "1.0.0",
      publisher: "example",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  await writeFile(
    join(inProcess, "extension.ts"),
    `export default { commands: [{ id: "capture", ref: { kind: "command", id: "capture" }, title: "Capture", run(ctx) { globalThis.__processRuntimeHostContext = ctx; } }] };`,
  );
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  const project = await handle.deps.projectService.create({ name: "Isolated" });
  projectId = project.id;
  await handle.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    installName: "isolated",
    extensionId: "example.isolated",
    name: "isolated",
    displayName: "Isolated",
    sourcePath: source,
    sourceKind: "local_path",
    manifest: {},
  });
  await handle.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    installName: "in-process",
    extensionId: "example.in-process",
    name: "in-process",
    displayName: "In process",
    sourcePath: inProcess,
    sourceKind: "local_path",
    manifest: {},
  });
});

afterAll(async () => {
  await handle?.close();
  await closeBackendWorkers();
  process.env.PSTDIO_HOME = previous.home;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
  await rm(root, { recursive: true, force: true });
});

const execute = async (command: string, params: Record<string, unknown> = {}, source?: string) => {
  const response = await handle.app.request(
    `/v1/projects/${projectId}/extensions/commands/example.isolated.command.${command}/execute`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ params, source }) },
  );
  return (await response.json()) as { outcome: { ok: boolean; value: unknown } };
};

test("a process-mode command runs in its worker and uses host storage through ctx", async () => {
  const { outcome } = await execute("save", { id: "a", text: "hello" });
  expect(outcome.ok).toBe(true);
  const value = outcome.value as { pid: number; stored: unknown; id: string };
  expect(value.pid).not.toBe(process.pid);
  expect(value.stored).toEqual({ text: "HELLO" });
  expect(value.id).toBe(handle.deps.extensionStorageService.recordId("project", projectId, "a"));
});

test("a process-mode command preserves a structured command rejection", async () => {
  const { outcome } = await execute("reject-stale");
  expect(outcome).toMatchObject({
    ok: false,
    status: "rejected",
    code: "stale_revision",
    reason: "Version changed",
    data: { expectedRevision: 1, actualRevision: 2 },
    cause: { code: "concurrent_save" },
    error: { message: "Changed", cause: { source: "storage" } },
    notices: [{ type: "warning", message: "Reload" }],
    diagnostics: [{ code: "conflict", message: "Revision changed", severity: "warning" }],
  });
});

test("a CPU-bound process-mode command does not block the API", async () => {
  let settled = false;
  const spinning = execute("spin").then((result) => {
    settled = true;
    return result;
  });
  // Let the command reach its worker before probing the host.
  await Bun.sleep(200);
  const health = await handle.app.request("/healthz");
  expect(health.status).toBe(200);
  expect(settled).toBe(false);
  expect((await spinning).outcome).toMatchObject({ ok: true, value: "spun" });
});

test("process-mode hooks run in the worker and unsupported providers are reported, not loaded", async () => {
  await execute("save", { id: "b", text: "again" });
  const stored = await execute("read-hooked");
  expect(stored.outcome.ok).toBe(true);
  expect((stored.outcome.value as { pid: number }).pid).not.toBe(process.pid);
  const snapshot = await handle.deps.extensionRuntimeCatalog.get(projectId);
  expect(snapshot.runtime.diagnostics).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: "extension_process_runtime_unsupported" })]),
  );
});

test("a crashed worker fails only its running call; the next call starts a new worker", async () => {
  const first = (await execute("save", { id: "c", text: "x" })).outcome.value as { pid: number };
  const crashed = await execute("crash");
  expect(crashed.outcome).toMatchObject({ ok: false });
  const after = (await execute("save", { id: "d", text: "y" })).outcome;
  expect(after.ok).toBe(true);
  expect((after.value as { pid: number }).pid).not.toBe(first.pid);
});

test("the process-mode surface accounts for every function of the host's real ctx", async () => {
  await handle.app.request(`/v1/projects/${projectId}/extensions/commands/example.in-process.command.capture/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ params: {} }),
  });
  const captured = (globalThis as { __processRuntimeHostContext?: { projectId: string } }).__processRuntimeHostContext;
  expect(captured?.projectId).toBe(projectId);
  expect(uncoveredContextFunctions(captured!)).toEqual([]);
});

test("host services answer a process-mode command", async () => {
  const { outcome } = await execute("port");
  expect(outcome.ok).toBe(true);
  expect(outcome.value).toBeGreaterThan(0);
});

test("process-mode leaves workspace files absent when the invocation has no workspace", async () => {
  expect((await execute("workspace-files")).outcome).toMatchObject({ ok: true, value: "absent" });
});

test("process-mode navigation checks invalid targets only for scoped invocations", async () => {
  expect((await execute("navigate", {}, "dashboard")).outcome).toMatchObject({
    ok: false,
    reason: "Invalid navigation target.",
  });
  expect((await execute("navigate")).outcome).toMatchObject({ ok: true, value: "ignored" });
});

test("a rejected revision keeps a cold accepted command callable through the catalog", async () => {
  const source = join(root, "cold-candidate");
  const extensionId = "example.cold-candidate";
  await mkdir(source);
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name: "cold-candidate",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      pstdio: { backendRuntime: "process" },
    }),
  );
  const entryPath = join(source, "extension.ts");
  await writeFile(
    entryPath,
    `export default { commands: [{
      id: "ping", ref: { kind: "command", id: "ping" }, title: "Ping", run: () => "accepted"
    }] };`,
  );
  await handle.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    installName: "cold-candidate",
    extensionId,
    name: "cold-candidate",
    displayName: "Cold candidate",
    sourcePath: source,
    sourceKind: "local_path",
    manifest: {},
  });
  const catalog = handle.deps.extensionRuntimeCatalog;
  const accepted = await catalog.get(projectId);
  const commandId = `${extensionId}.command.ping`;
  expect(accepted.runtime.commands.some((command) => command.id === commandId)).toBe(true);

  await writeFile(
    entryPath,
    `export default { resourceKinds: [{
      id: "invalid", ref: { kind: "resource-kind", id: "invalid" }, label: "Invalid", prefix: "WS"
    }] };`,
  );
  const inspected = await prepareExtensionRevision(source);
  const rejection = await catalog
    .validateResourcePrefixes(projectId, {
      extension_id: extensionId,
      source_path: source,
      source_kind: "local_path",
      preparedRevision: inspected,
    })
    .catch((error) => error);
  expect(rejection).toMatchObject({
    diagnostics: [expect.objectContaining({ code: "extension_resource_prefix_invalid" })],
  });

  const response = await handle.app.request(`/v1/projects/${projectId}/extensions/commands/${commandId}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ params: {} }),
  });
  expect((await response.json()).outcome).toMatchObject({ ok: true, value: "accepted" });
});

test("an accepted source can return to the same content after another generation ran", async () => {
  const source = join(root, "restored-candidate");
  const extensionId = "example.restored-candidate";
  await mkdir(source);
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name: "restored-candidate",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      pstdio: { backendRuntime: "process" },
    }),
  );
  const entryPath = join(source, "extension.ts");
  const define = (value: string) =>
    `export default { commands: [{
      id: "ping", ref: { kind: "command", id: "ping" }, title: "Ping", run: () => ${JSON.stringify(value)}
    }] };`;
  const original = define("original");
  await writeFile(entryPath, original);
  await handle.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    installName: "restored-candidate",
    extensionId,
    name: "restored-candidate",
    displayName: "Restored candidate",
    sourcePath: source,
    sourceKind: "local_path",
    manifest: {},
  });
  const ping = async () => {
    const response = await handle.app.request(
      `/v1/projects/${projectId}/extensions/commands/${extensionId}.command.ping/execute`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ params: {} }) },
    );
    return (await response.json()).outcome;
  };
  expect(await ping()).toMatchObject({ ok: true, value: "original" });
  await writeFile(entryPath, define("replacement"));
  await handle.deps.extensionService.reloadInstalledSourceBySourcePath(source);
  expect(await ping()).toMatchObject({ ok: true, value: "replacement" });
  await writeFile(entryPath, original);
  await handle.deps.extensionService.reloadInstalledSourceBySourcePath(source);
  expect(await ping()).toMatchObject({ ok: true, value: "original" });
  await writeFile(entryPath, define("replacement"));
  await handle.deps.extensionService.reloadInstalledSourceBySourcePath(source);
  expect(await ping()).toMatchObject({ ok: true, value: "replacement" });
});
