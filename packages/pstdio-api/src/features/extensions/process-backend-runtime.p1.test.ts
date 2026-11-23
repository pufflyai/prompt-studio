import { afterAll, beforeAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStorageMigration } from "pstdio-api-contracts";
import { EXTENSION_API_VERSION, type ExtensionContextBase } from "pstdio-api-contracts/extension-kernel";
import { closeBackendWorkers, prepareExtensionRevision, uncoveredContextFunctions } from "pstdio-extensions";
import { createTestApp } from "../../test-utils/create-test-app";

let root: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let projectId: string;
let terminalProjectId: string;
const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };

const assetBody = `${"part".repeat(65_537)}asset body`;

const entry = `
const item = (ctx) => ctx.storage.collection("items");
export default {
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
      id: "migrate",
      ref: { kind: "command", id: "migrate" },
      title: "Migrate",
      async run(ctx) {
        await ctx.storage.migrate(1, async (previous) => {
          await ctx.storage.set("migrated-from", previous);
        });
        return ctx.storage.get("migrated-from");
      },
    },
    {
      id: "migrate-records",
      ref: { kind: "command", id: "migrate-records" },
      title: "Migrate records",
      async run(ctx) {
        const selector = { type: "resource", resource: { type: "fixture", id: "original" } };
        const storage = ctx.storage.scope(selector);
        selector.resource.id = "another";
        await storage.collection("legacy").put("entry", { imported: true });
        let id;
        await storage.migrate(2, async (previous, migration) => {
          const { moved } = await migration.moveCollection("legacy", { keyPrefix: "import-" });
          id = migration.id("source", "nt");
          const position = migration.position(0, "entry");
          await storage.records.commit({ operationId: id, edits: [{ recordId: id, replace: { moved, previous, position } }] });
        });
        return { id, value: (await storage.records.read(id)).value };
      },
    },
    {
      id: "observe",
      ref: { kind: "command", id: "observe" },
      title: "Observe",
      async run(ctx) {
        const recordId = ctx.storage.records.id("watched");
        let seen = 0;
        const handle = ctx.storage.observe(() => { seen += 1; }, { recordIds: [recordId] });
        await new Promise((resolve) => setTimeout(resolve, 50));
        await ctx.storage.set("watched", "changed");
        for (let attempt = 0; seen === 0 && attempt < 50; attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
        handle.close();
        return seen;
      },
    },
    {
      id: "locals",
      ref: { kind: "command", id: "locals" },
      title: "Locals",
      async run(ctx) {
        const first = ctx.storage.positions.between();
        const selector = { type: "resource", resource: { type: "ticket", id: "r1" } };
        const scoped = ctx.storage.scope(selector);
        const recordId = scoped.records.id("k");
        selector.resource.id = "r2";
        await scoped.set("k", "resource");
        const customSelector = { type: "custom", id: "one" };
        const custom = scoped.scope(customSelector);
        const customId = custom.records.id("k");
        customSelector.id = "two";
        await custom.set("k", "custom");
        return {
          scoped: recordId,
          resource: await ctx.storage.scope({ type: "resource", resource: { type: "ticket", id: "r1" } }).get("k"),
          custom: await scoped.scope({ type: "custom", id: "one" }).get("k"),
          customId,
          projectId: custom.scope({ type: "project" }).records.id("k"),
          url: ctx.storage.files.urlFor("f1"),
          ordered: ctx.storage.positions.between(undefined, first) < first,
        };
      },
    },
    {
      id: "asset",
      ref: { kind: "command", id: "asset" },
      title: "Asset",
      async run(ctx) {
        const source = Bun.file(new URL("./asset.bin", import.meta.url));
        source.arrayBuffer = () => { throw new Error("Asset staging must avoid a full-file read"); };
        const asset = await ctx.storage.assets.stage({ operationId: "op-asset", source });
        await ctx.storage.assets.verifyComplete([asset]);
        const hash = new Bun.CryptoHasher("sha256");
        for await (const chunk of await ctx.storage.assets.read(asset)) hash.update(chunk);
        return { asset, verifiedSha256: hash.digest("hex") };
      },
    },
    {
      id: "port",
      ref: { kind: "command", id: "port" },
      title: "Port",
      run: (ctx) => ctx.net.findFreePort(),
    },
    {
      id: "terminal",
      ref: { kind: "command", id: "terminal" },
      title: "Terminal",
      async run(ctx, params) {
        const session = ctx.terminal.openSession({ command: params.command, cols: 80, rows: 24 });
        session.write("hello\\r");
        const events = [];
        let text = "";
        for await (const event of session.events()) {
          events.push(event.kind);
          if (event.kind === "data") text += new TextDecoder().decode(event.chunk);
          if (event.kind === "error") text += event.message;
        }
        return { text, last: events.at(-1) };
      },
    },
    {
      id: "spawn",
      ref: { kind: "command", id: "spawn" },
      title: "Spawn",
      async run(ctx, params) {
        const handle = ctx.process.spawn({ command: params.command });
        await handle.started;
        await handle.write("hello ");
        await handle.write(new TextEncoder().encode("worker"));
        await handle.end();
        const seen = [];
        for await (const event of handle.events())
          seen.push(event.type === "exit" ? event : { type: event.type, text: new TextDecoder().decode(event.data) });
        const late = ctx.process.spawn({ command: params.command, lifetime: "extension" });
        const marker = await late.started.then(() => "started", (error) => error.code);
        await late.kill();
        return { seen, exited: await handle.exited, idType: typeof handle.id, extension: marker };
      },
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
  await writeFile(join(source, "asset.bin"), assetBody);
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
  const terminalProject = await handle.deps.projectService.create({ name: "With terminal workspace" });
  terminalProjectId = terminalProject.id;
  const folder = join(root, "project");
  await mkdir(folder);
  await handle.deps.workspaceService.ensureDefault({
    project_id: terminalProjectId,
    root_path: folder,
    name: "Project folder",
  });
  for (const id of [projectId, terminalProjectId]) {
    await handle.deps.extensionService.enableInstalledSourceForProject({
      projectId: id,
      installName: "isolated",
      extensionId: "example.isolated",
      name: "isolated",
      displayName: "Isolated",
      sourcePath: source,
      sourceKind: "local_path",
      manifest: {},
    });
  }
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

const execute = async (
  command: string,
  params: Record<string, unknown> = {},
  source?: string,
  selectedProject = projectId,
) => {
  const response = await handle.app.request(
    `/v1/projects/${selectedProject}/extensions/commands/example.isolated.command.${command}/execute`,
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

test("process-mode hooks run in the worker", async () => {
  await execute("save", { id: "b", text: "again" });
  const stored = await execute("read-hooked");
  expect(stored.outcome.ok).toBe(true);
  expect((stored.outcome.value as { pid: number }).pid).not.toBe(process.pid);
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

test("process-mode handlers can pass callbacks to host storage", async () => {
  expect((await execute("migrate")).outcome).toMatchObject({ ok: true, value: 0 });
  const observed = (await execute("observe")).outcome;
  expect(observed.ok).toBe(true);
  expect(observed.value).toBeGreaterThan(0);
});

test("process-mode migration helpers preserve scoped identity and allow record moves and commits", async () => {
  const migration = createStorageMigration(["example.isolated", projectId, "resource", "original", 2]);
  expect((await execute("migrate-records")).outcome).toMatchObject({
    ok: true,
    value: {
      id: migration.id("source", "nt"),
      value: { moved: 1, previous: 0, position: migration.position(0, "entry") },
    },
  });
});

test("process-mode local helpers match the host's own results", async () => {
  await handle.app.request(`/v1/projects/${projectId}/extensions/commands/example.in-process.command.capture/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ params: {} }),
  });
  const host = (globalThis as { __processRuntimeHostContext?: ExtensionContextBase }).__processRuntimeHostContext!;
  const { outcome } = await execute("locals");
  expect(outcome.ok).toBe(true);
  const value = outcome.value as { scoped: string; url: string; ordered: boolean };
  expect(value.scoped).toBe(
    host.storage.scope({ type: "resource", resource: { type: "ticket", id: "r1" } }).records.id("k"),
  );
  expect(value).toMatchObject({
    resource: "resource",
    custom: "custom",
    customId: host.storage.scope({ type: "custom", id: "one" }).records.id("k"),
    projectId: host.storage.records.id("k"),
  });
  expect(value.url).toBe(host.storage.files.urlFor("f1").replace("example.in-process", "example.isolated"));
  expect(value.ordered).toBe(true);
});

test("process-mode handlers resume file-backed assets and read verified bytes", async () => {
  const owner = { workbenchId: projectId, extensionId: "example.isolated" };
  const operationId = "op-asset";
  const asset = {
    sha256: createHash("sha256").update(assetBody).digest("hex"),
    byteLength: Buffer.byteLength(assetBody),
    mediaType: "application/octet-stream",
  };
  const offset = 123;
  const service = handle.deps.assetTransferService;
  await service.begin(owner, operationId, asset);
  await service.append(owner, operationId, 0, new Blob([assetBody.slice(0, offset)]).stream());
  expect(await service.get(owner, operationId)).toMatchObject({ status: "staging", uploadedByteLength: offset });
  expect((await execute("asset")).outcome).toMatchObject({ ok: true, value: { asset, verifiedSha256: asset.sha256 } });
  expect(await service.get(owner, operationId)).toMatchObject({ status: "complete", asset });
});

test("a process-mode handler opens a terminal session, writes to it and reads it to the end", async () => {
  const script = `process.stdin.once("data", (data) => { process.stdout.write("got:" + String(data).trim()); process.exit(0); });`;
  const { outcome } = await execute(
    "terminal",
    { command: [process.execPath, "-e", script] },
    undefined,
    terminalProjectId,
  );
  expect(outcome.ok).toBe(true);
  const value = outcome.value as { text: string; last: string };
  expect(value.text).toContain("got:hello");
  expect(value.last).toBe("exit");
});

test("a process-mode handler spawns a host-owned child, writes its stdin and streams its output to the exit", async () => {
  const script = `for await (const chunk of Bun.stdin.stream()) process.stdout.write(new TextDecoder().decode(chunk).toUpperCase());`;
  const { outcome } = await execute("spawn", { command: [process.execPath, "-e", script] });
  expect(outcome.ok).toBe(true);
  const value = outcome.value as {
    seen: { type: string; text?: string; exit?: unknown }[];
    exited: unknown;
    idType: string;
    extension: string;
  };
  expect(
    value.seen
      .filter((event) => event.type === "stdout")
      .map((event) => event.text)
      .join(""),
  ).toBe("HELLO WORKER");
  expect(value.seen.at(-1)).toEqual({ type: "exit", exit: { code: 0, signal: null } });
  expect(value.exited).toEqual({ code: 0, signal: null });
  expect(value.idType).toBe("string");
  expect(value.extension).toBe("started");
});
