import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commandRefId } from "@pstdio/sdk/extensions";
import { createTestApp } from "../../test-utils/create-test-app";
import { provisionProjectWorkspaces } from "./provision-coordinator";
import { findWorkspaceProvider, runWorkspaceProviderOperation } from "./workspace-provider-runtime";

type LocalProviderState = ReturnType<typeof setupLocalProvider>;

const providerId = "fixture.local-provider.workspace-type.local";

const setupLocalProvider = (options: { backendRuntime?: "process" }) => {
  const s = {
    root: "",
    projectId: "",
    sourceFolder: "",
    handle: undefined as unknown as Awaited<ReturnType<typeof createTestApp>>,
    post: (path: string, data: unknown) =>
      s.handle.app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      }),
    openApp: () => createTestApp({ databasePath: join(s.root, "database"), storageRoot: join(s.root, "storage") }),
    enableProvider: async (projectId: string) => {
      const enabled = await s.post(`/v1/projects/${projectId}/extensions/installed/local-provider/enable`, {
        name: "local-provider",
        displayName: "Local provider",
        extensionId: "fixture.local-provider",
        manifest: fixtureManifest,
        sourcePath: join(s.root, "local-provider"),
        sourceHash: null,
        sourceKind: "local_path",
        sourceRef: null,
        version: "0.0.1",
      });
      expect(enabled.status).toBe(200);
    },
    providerDirectory: async (workspaceId: string) => {
      const runtime = await findWorkspaceProvider(s.handle.deps, { projectId: s.projectId, providerId, workspaceId });
      if (!runtime) throw new Error("Fixture provider is unavailable.");
      return runtime.context.localDirectory!();
    },
  };
  let previous: { home?: string; defaults?: string };
  const fixtureManifest = {
    name: "local-provider",
    publisher: "fixture",
    version: "0.0.1",
    main: "extension.ts",
    engines: { pstdio: "^0.4.0 || ^0.5.0" },
    ...(options.backendRuntime ? { pstdio: { backendRuntime: options.backendRuntime } } : {}),
  };
  const fixtureSource = `
  const capabilities = { files: "write", diff: false, merge: false, rebase: false, delete: true };
  const result = (directory) => ({
    state: "ready", executionKind: "local", capabilities,
    providerRef: { version: 1, data: { directory: directory.path } },
    executionTarget: { kind: "local", rootPath: directory.path },
  });
  const optionSource = (command) => ({ command: { kind: "command", id: command }, valueField: "id", labelField: "name" });
  export default { commands: [{ id: "ordinary", ref: { kind: "command", id: "ordinary" }, title: "Ordinary process",
    run: (ctx) => ctx.process.runOrThrow({ command: ["bun", "-e", "process.stdout.write('ran')"] }) }, { id: "choices", ref: { kind: "command", id: "choices" }, title: "Choices", run: () => [{ id: "main", name: "Main" }] }], workspaceTypes: [{
    id: "local", ref: { kind: "workspace-type", id: "local" }, label: "Local environment",
    async discover(ctx) {
      const revision = (await ctx.projectFiles.readText("revision.txt")).trim();
      return revision === "unavailable" ? null : { params: {
        revision: { type: "text", defaultValue: revision },
        branch: { type: "select", options: optionSource(revision === "invalid" ? "missing" : "choices") },
        labels: { type: "multi-select", options: optionSource("choices") },
      } };
    },
    async create(ctx, input) {
      const directory = await ctx.localDirectory();
      await directory.files.writeText("identity.json", JSON.stringify({ id: input.workspaceId, ...input.params }));
      if (input.params.revision === "fail-before-reference") throw new Error("Create failed after local allocation");
      const process = await ctx.process.runOrThrow({
        command: ["bun", "-e", "process.stdout.write(process.cwd())"], cwd: directory.path,
      });
      if (process.stdout !== directory.path) throw new Error("Provider process used a different directory.");
      return result(directory);
    },
    async validateParams(ctx, input) {
      await ctx.projectFiles.readText("revision.txt");
      if (input.revision === "missing") throw new Error("Choose an existing revision.");
    },
    async resolve(ctx) {
      const directory = await ctx.localDirectory();
      await directory.files.writeText("resolved.txt", directory.path);
      return result(directory);
    },
    async delete(ctx) { await (await ctx.localDirectory()).remove(); },
  }] };
  `;

  beforeAll(async () => {
    s.root = await realpath(await mkdtemp(join(tmpdir(), "installed-local-provider-")));
    previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
    process.env.PSTDIO_HOME = join(s.root, "home");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    s.sourceFolder = join(s.root, "project");
    const extensionPath = join(s.root, "local-provider");
    await mkdir(s.sourceFolder);
    await mkdir(extensionPath);
    await writeFile(join(s.sourceFolder, "revision.txt"), "main");
    await writeFile(join(extensionPath, "package.json"), JSON.stringify(fixtureManifest));
    await writeFile(join(extensionPath, "extension.ts"), fixtureSource);
    s.handle = await s.openApp();
    const created = await s.post("/v1/projects", {
      name: "Local provider",
      initial_workspace: { provider_id: "pstdio.root", params: { path: s.sourceFolder } },
    });
    expect(created.status).toBe(201);
    s.projectId = (await created.json()).id;
    await s.enableProvider(s.projectId);
    const snapshot = await s.handle.deps.extensionRuntimeCatalog.get(s.projectId);
    expect(snapshot.runtime.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    expect(snapshot.runtime.workspaceTypes.map((item) => item.id)).toContain(providerId);
  });

  afterAll(async () => {
    await s.handle?.close();
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
    await rm(s.root, { recursive: true, force: true });
  });
  return s;
};

const discoveryAndDirectoryTests = (s: LocalProviderState) => {
  test("an installed provider discovers current choices through its public project context", async () => {
    const providers = async () =>
      await (await s.handle.app.request(`/v1/projects/${s.projectId}/workspace-providers`)).json();
    expect(await providers()).toMatchObject([{ id: providerId, params: { revision: { defaultValue: "main" } } }]);
    await writeFile(join(s.sourceFolder, "revision.txt"), "review");
    expect(await providers()).toMatchObject([{ id: providerId, params: { revision: { defaultValue: "review" } } }]);
  });

  test("an installed local provider prepares its directory before readiness and reopens it after restart", async () => {
    // This case also runs without the preceding discovery check in quarantine.
    await writeFile(join(s.sourceFolder, "revision.txt"), "review");
    const created = await s.post("/v1/workspaces", { project_id: s.projectId, provider_id: providerId, params: {} });
    expect(created.status).toBe(201);
    const workspace = await created.json();
    expect(workspace).toMatchObject({ provider_state: "ready", execution_kind: "local", provider_error_json: null });
    const directory = join(s.root, "home", "workspaces", workspace.id);
    expect(workspace.root_path).toBe(directory);
    expect(JSON.parse(await readFile(join(directory, "identity.json"), "utf8"))).toEqual({
      id: workspace.id,
      revision: "review",
    });
    await s.handle.close();
    const resolved = join(directory, "resolved.txt");
    await rm(resolved, { force: true });
    s.handle = await s.openApp();
    const deadline = Date.now() + 2000;
    const readResolvedDirectory = () =>
      readFile(resolved, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    let resolvedDirectory = await readResolvedDirectory();
    while (resolvedDirectory !== directory && Date.now() < deadline) {
      await Bun.sleep(10);
      resolvedDirectory = await readResolvedDirectory();
    }
    expect(resolvedDirectory).toBe(directory);
    const runtime = await findWorkspaceProvider(s.handle.deps, {
      projectId: s.projectId,
      providerId,
      workspaceId: workspace.id,
    });
    expect(runtime).toBeDefined();
    // Catalog reload schedules the normal project setup queue. Join it before
    // checking command readiness or removing its local target.
    await provisionProjectWorkspaces(s.handle.deps, s.projectId);
    expect(await s.handle.deps.workspaceService.get(workspace.id)).toMatchObject({
      initializing: false,
      setup_error: null,
      provider_state: "ready",
      root_path: directory,
      provider_ref_json: workspace.provider_ref_json,
    });
    expect(await runtime!.context.workspaces.get(workspace.id)).toMatchObject({
      id: workspace.id,
      rootPath: directory,
      providerId,
    });
    await runtime!.context.workspaces.delete(workspace.id);
    expect(existsSync(directory)).toBe(false);
    expect(existsSync(s.sourceFolder)).toBe(true);
  });

  test("provider directory access protects default and foreign workspaces", async () => {
    const home = await s.handle.deps.workspaceService.getDefault(s.projectId);
    await expect(s.providerDirectory(home!.id)).rejects.toThrow(/Default workspace/);
    const other = await s.handle.deps.projectService.create({ name: "Other project" });
    const foreign = await s.handle.deps.workspaceService.create({
      project_id: other.id,
      provider_id: providerId,
      shorthand_base: "FOREIGN",
      provider_state: "provisioning",
    });
    await expect(s.providerDirectory(foreign.id)).rejects.toThrow(/does not own/);
    expect(await readFile(join(s.sourceFolder, "revision.txt"), "utf8")).toBe("review");
  });

  test("provider directory access rejects a managed path linked to another directory", async () => {
    const workspace = await s.handle.deps.workspaceService.create({
      project_id: s.projectId,
      provider_id: providerId,
      shorthand_base: "LINK",
      provider_state: "provisioning",
    });
    const outside = join(s.root, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "keep.txt"), "Retain this");
    const path = join(s.root, "home", "workspaces", workspace.id);
    await mkdir(join(s.root, "home", "workspaces"), { recursive: true });
    await symlink(outside, path, process.platform === "win32" ? "junction" : "dir");
    await expect(s.providerDirectory(workspace.id)).rejects.toThrow(/owned directory/);
    expect(await readFile(join(outside, "keep.txt"), "utf8")).toBe("Retain this");
  });

  test("cancelling a provider operation stops its child before the operation rejects", async () => {
    const processRoot = join(s.root, "process-root");
    await mkdir(processRoot);
    const workspace = await s.handle.deps.workspaceService.create({
      project_id: s.projectId,
      provider_id: providerId,
      shorthand_base: "PROCESS",
      provider_state: "ready",
      root_path: processRoot,
    });
    const runtime = await findWorkspaceProvider(s.handle.deps, {
      projectId: s.projectId,
      providerId,
      workspaceId: workspace.id,
    });
    const marker = join(s.root, "child.pid");
    const controller = new AbortController();
    const pending = runWorkspaceProviderOperation(
      runtime!,
      async (ctx) => {
        void ctx.process
          .runOrThrow({
            command: [
              process.execPath,
              "-e",
              "const fs = require('fs'); const path = process.argv[1]; fs.writeFileSync(path + '.tmp', String(process.pid)); fs.renameSync(path + '.tmp', path); setInterval(() => {}, 1000)",
              marker,
            ],
          })
          .catch(() => {});
        await new Promise(() => {});
      },
      { signal: controller.signal },
    );
    let pid: number | undefined;
    try {
      const deadline = Date.now() + 2000;
      while (!existsSync(marker) && Date.now() < deadline) await Bun.sleep(10);
      pid = Number(await readFile(marker, "utf8"));
      controller.abort();
      await expect(pending).rejects.toThrow(/aborted/);
      expect(() => process.kill(pid!, 0)).toThrow();
    } finally {
      controller.abort();
      if (pid) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      }
    }
  });
};

const validationAndOwnershipTests = (s: LocalProviderState) => {
  test("an installed provider that becomes unavailable cannot create a workspace", async () => {
    await provisionProjectWorkspaces(s.handle.deps, s.projectId);
    await writeFile(join(s.sourceFolder, "revision.txt"), "unavailable");
    try {
      const response = await s.post("/v1/workspaces", { project_id: s.projectId, provider_id: providerId, params: {} });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: expect.stringContaining("unavailable") });
    } finally {
      await writeFile(join(s.sourceFolder, "revision.txt"), "review");
    }
  });

  test("installed validation rejects semantic values before storing a workspace or allocating files", async () => {
    // Restart recovery may still re-provision the earlier project's default workspace.
    // Validate against a fresh project whose target is owned only by this test.
    const folder = join(s.root, "validation-project");
    await mkdir(folder);
    await writeFile(join(folder, "revision.txt"), "review");
    const created = await s.post("/v1/projects", {
      name: "Provider validation",
      initial_workspace: { provider_id: "pstdio.root", params: { path: folder } },
    });
    expect(created.status).toBe(201);
    const validationProjectId = (await created.json()).id as string;
    await s.enableProvider(validationProjectId);
    const before = await s.handle.deps.workspaceService.list(validationProjectId);
    const response = await s.post("/v1/workspaces", {
      project_id: validationProjectId,
      provider_id: providerId,
      params: { revision: "missing" },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Choose an existing revision.") });
    const after = await s.handle.deps.workspaceService.list(validationProjectId);
    expect(after.map((workspace) => workspace.id).sort()).toEqual(before.map((workspace) => workspace.id).sort());
  });

  test("a completed provider cannot allocate or write through a retained directory", async () => {
    const workspace = await s.handle.deps.workspaceService.create({
      project_id: s.projectId,
      provider_id: providerId,
      shorthand_base: "COMPLETED",
      provider_state: "provisioning",
    });
    const runtime = await findWorkspaceProvider(s.handle.deps, {
      projectId: s.projectId,
      providerId,
      workspaceId: workspace.id,
    });
    let retained: NonNullable<typeof runtime>["context"];
    const directory = await runWorkspaceProviderOperation(runtime!, async (ctx) => {
      retained = ctx;
      return ctx.localDirectory!();
    });
    await expect(retained!.localDirectory!()).rejects.toThrow(/ended/);
    await expect(directory.files.writeText("late.txt", "Too late")).rejects.toThrow(/ended/);
  });

  test.each(["timeout", "return"] as const)("provider %s releases its still-running child", async (phase) => {
    const workspace = await s.handle.deps.workspaceService.create({
      project_id: s.projectId,
      provider_id: providerId,
      shorthand_base: phase,
      provider_state: "provisioning",
    });
    const runtime = await findWorkspaceProvider(s.handle.deps, {
      projectId: s.projectId,
      providerId,
      workspaceId: workspace.id,
    });
    const marker = join(s.root, `${phase}.pid`);
    let pid: number | undefined;
    const pending = runWorkspaceProviderOperation(
      runtime!,
      async (ctx) => {
        void ctx.process
          .runOrThrow({
            command: [
              process.execPath,
              "-e",
              "const fs = require('fs'); const path = process.argv[1]; fs.writeFileSync(path + '.tmp', String(process.pid)); fs.renameSync(path + '.tmp', path); setInterval(() => {}, 1000)",
              marker,
            ],
          })
          .catch(() => {});
        const deadline = Date.now() + 2000;
        while (!existsSync(marker) && Date.now() < deadline) await Bun.sleep(10);
        pid = Number(await readFile(marker, "utf8"));
        if (phase === "timeout") await new Promise(() => {});
      },
      { timeoutMs: phase === "timeout" ? 1000 : undefined },
    );
    try {
      if (phase === "timeout") await expect(pending).rejects.toThrow(/timed out/);
      else await pending;
      expect(pid).toBeGreaterThan(0);
      expect(() => process.kill(pid!, 0)).toThrow();
    } finally {
      if (pid) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      }
    }
  });

  test("ending a provider during ownership resolution prevents late directory allocation", async () => {
    const workspace = await s.handle.deps.workspaceService.create({
      project_id: s.projectId,
      provider_id: providerId,
      shorthand_base: "LATE",
      provider_state: "provisioning",
    });
    const runtime = await findWorkspaceProvider(s.handle.deps, {
      projectId: s.projectId,
      providerId,
      workspaceId: workspace.id,
    });
    const gate = Promise.withResolvers<void>();
    const originalGet = s.handle.deps.workspaceService.get;
    s.handle.deps.workspaceService.get = async (id) => {
      const row = await originalGet(id);
      await gate.promise;
      return row;
    };
    let pending: ReturnType<NonNullable<NonNullable<typeof runtime>["context"]["localDirectory"]>>;
    try {
      await runWorkspaceProviderOperation(runtime!, (ctx) => {
        pending = ctx.localDirectory!();
      });
      gate.resolve();
      await expect(pending!).rejects.toThrow(/ended/);
      expect(existsSync(join(s.root, "home", "workspaces", workspace.id))).toBe(false);
    } finally {
      gate.resolve();
      s.handle.deps.workspaceService.get = originalGet;
    }
  });
};

const choiceAndRecoveryTests = (s: LocalProviderState) => {
  test("installed discovery qualifies local choice commands for select and multi-select fields", async () => {
    const response = await s.handle.app.request(`/v1/projects/${s.projectId}/workspace-providers`);
    const provider = (await response.json()).find((item: { id: string }) => item.id === providerId);
    for (const key of ["branch", "labels"]) {
      const command = provider.params[key].options.command;
      expect(command.extensionId).toBe("fixture.local-provider");
      const executed = await s.post(
        `/v1/projects/${s.projectId}/extensions/commands/${commandRefId(command)}/execute`,
        {
          source: "api",
        },
      );
      expect(executed.status).toBe(200);
      expect((await executed.json()).outcome).toMatchObject({ ok: true, value: [{ id: "main", name: "Main" }] });
    }
  });

  test("installed discovery validates option commands before advertising its schema", async () => {
    await writeFile(join(s.sourceFolder, "revision.txt"), "invalid");
    try {
      const response = await s.handle.app.request(`/v1/projects/${s.projectId}/workspace-providers`);
      expect(await response.json()).toEqual([]);
    } finally {
      await writeFile(join(s.sourceFolder, "revision.txt"), "review");
    }
  });

  test("commands invoked by a provider retain ordinary target readiness", async () => {
    const workspace = await s.handle.deps.workspaceService.create({
      project_id: s.projectId,
      provider_id: providerId,
      shorthand_base: "NESTED",
      provider_state: "provisioning",
    });
    const runtime = await findWorkspaceProvider(s.handle.deps, {
      projectId: s.projectId,
      providerId,
      workspaceId: workspace.id,
    });
    const result = await runWorkspaceProviderOperation(runtime!, (ctx) =>
      ctx.commands.execute({ kind: "command", id: "ordinary" }, { params: {} }),
    );
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: expect.stringContaining("local process target") });
  });

  test("deleting a failed create releases owned files while retaining unknown external recovery", async () => {
    const response = await s.post("/v1/workspaces", {
      project_id: s.projectId,
      provider_id: providerId,
      params: { revision: "fail-before-reference" },
    });
    const workspace = await response.json();
    expect(workspace.provider_state).toBe("failed");
    const path = join(s.root, "home", "workspaces", workspace.id);
    expect(existsSync(path)).toBe(true);
    const deleted = await s.handle.app.request(`/v1/workspaces/${workspace.id}`, { method: "DELETE" });
    expect(deleted.status).toBe(409);
    expect(existsSync(path)).toBe(false);
    const retained = await s.handle.deps.workspaceService.get(workspace.id);
    expect(retained?.deleted_at).toBeNull();
    expect(retained?.provider_operation_kind).toBe("delete");
    expect(retained?.provider_operation_id).toBe(workspace.provider_operation_id);
  });
};

/** The installed local provider suite, run once in the API process and once in a backend worker. */
export const localProviderSuite = (options: { backendRuntime?: "process" } = {}) => {
  const s = setupLocalProvider(options);
  discoveryAndDirectoryTests(s);
  validationAndOwnershipTests(s);
  choiceAndRecoveryTests(s);
};
