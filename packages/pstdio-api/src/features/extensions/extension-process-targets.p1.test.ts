import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, relative } from "node:path";
import { EXTENSION_API_VERSION, type ProcessExit, type ProcessHandle } from "pstdio-api-contracts/extension-kernel";
import { createProcessOwner } from "pstdio-extensions";
import { createTestApp } from "../../test-utils/create-test-app";
import { remoteReadOnlyCapabilities } from "../workspaces/workspace-provider-identity";
import { defaultWorkspaceProviderRuntime } from "../workspaces/workspace-provider-runtime";
import { createProcessApi } from "./extension-process-api";
import { createExtensionProcessOwners } from "./extension-process-owners";
import { readTargetText, resolveProcessTarget } from "./extension-targets";

let root: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let closed = false;
const projects = { main: "", other: "" };
const workspaces = { remote: "", bare: "", slow: "", late: "", other: "" };
let instanceId = "";
const providerRef = { version: 1, data: { machine: "devbox-7" } };
const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };

type Seen = { extensionId: string; projectId: string; commandId?: string; provider: boolean; input: unknown };
const seen = () => (globalThis as { __targetCalls?: Seen[] }).__targetCalls ?? [];

const entry = `
const record = (ctx, input) => {
  globalThis.__targetCalls ??= [];
  globalThis.__targetCalls.push({
    extensionId: ctx.extensionId,
    projectId: ctx.projectId,
    commandId: ctx.commandId,
    provider: typeof ctx.localDirectory === "function",
    input,
  });
};
const ready = (input) => ({ state: "ready", executionKind: "remote", providerRef: input.providerRef, capabilities: { files: "none", diff: false, merge: false, rebase: false, delete: true } });
export default {
  commands: [
    {
      id: "delay-spawn",
      ref: { kind: "command", id: "delay-spawn" },
      title: "Delay spawn",
      async run(ctx, params) {
        const gate = globalThis.__delaySpawn;
        gate.entered();
        await gate.resume;
        const child = ctx.process.spawn({ command: params.command, lifetime: "extension" });
        const started = await child.started.then(() => "started", (error) => error.code);
        await child.exited;
        return started;
      },
    },
    {
      id: "spawn",
      ref: { kind: "command", id: "spawn" },
      title: "Spawn",
      async run(ctx, params) {
        const handle = ctx.process.spawn(params);
        let startError = null;
        await handle.started.catch((error) => { startError = error.code ?? error.message; });
        let stdout = "";
        let exit;
        for await (const event of handle.events()) {
          if (event.type === "stdout") stdout += new TextDecoder().decode(event.data);
          if (event.type === "exit") exit = event.exit;
        }
        return { stdout, exit, startError };
      },
    },
    {
      id: "fire",
      ref: { kind: "command", id: "fire" },
      title: "Fire",
      async run(ctx, params) {
        ctx.process.spawn(params);
        // Return only once the provider is inside its spawn call.
        while (!globalThis.__slowProviderEntered) await new Promise((resolve) => setTimeout(resolve, 10));
        return "returned";
      },
    },
    {
      id: "fire-extension",
      ref: { kind: "command", id: "fire-extension" },
      title: "Fire for extension lifetime",
      async run(ctx, params) {
        const fixture = globalThis.__lateProvider;
        const child = ctx.process.spawn({ ...params, lifetime: "extension" });
        fixture.observe(child.started);
        await fixture.dispatched;
        return "returned";
      },
    },
    {
      id: "keep",
      ref: { kind: "command", id: "keep" },
      title: "Keep",
      async run(ctx, params) {
        await ctx.process.spawn({ command: params.command, lifetime: "extension" }).started;
      },
    },
  ],
  workspaceTypes: [
    {
      id: "remote",
      ref: { kind: "workspace-type", id: "remote" },
      label: "Remote",
      create: ready,
      resolve: ready,
      spawn(ctx, { signal, ...input }) {
        record(ctx, input);
        return ctx.process.spawn({ command: [process.execPath, "-e", "process.stdout.write('ran remotely')"] });
      },
      readText(ctx, input) {
        record(ctx, input);
        return "remote text at " + input.path;
      },
    },
    { id: "bare", ref: { kind: "workspace-type", id: "bare" }, label: "Bare", create: ready, resolve: ready },
    {
      id: "slow",
      ref: { kind: "workspace-type", id: "slow" },
      label: "Slow",
      create: ready,
      resolve: ready,
      // Starts a local helper, then never answers; the caller must not wait for it.
      spawn(ctx) {
        globalThis.__slowProviderHelper = ctx.process.spawn({ command: [process.execPath, "-e", "setInterval(() => {}, 1000)"] });
        globalThis.__slowProviderEntered = true;
        return new Promise(() => {});
      },
    },
    {
      id: "late",
      ref: { kind: "workspace-type", id: "late" },
      label: "Late",
      create: ready,
      resolve: ready,
      spawn() {
        const fixture = globalThis.__lateProvider;
        fixture.spawns++;
        fixture.entered();
        return fixture.reply;
      },
    },
  ],
};
`;

const writeTree = async () => {
  await writeFile(
    join(root, "tree.ts"),
    `const grandchild = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], { stdout: "inherit", stderr: "inherit" });
await Bun.write(process.argv[2], JSON.stringify([process.pid, grandchild.pid]));
setInterval(() => {}, 1000);`,
  );
};

const addRemoteWorkspace = async (projectId: string, type: "remote" | "bare" | "slow" | "late") => {
  const workspace = await handle.deps.workspaceService.createStandalone({
    project_id: projectId,
    provider_id: `example.spawner.workspace-type.${type}`,
  });
  await handle.deps.workspaceService.updateProviderProjection(workspace.id, {
    execution_kind: "remote",
    provider_state: "ready",
    provider_capabilities_json: remoteReadOnlyCapabilities,
    provider_ref_json: providerRef,
  });
  return workspace.id;
};

const enable = (projectId: string) =>
  handle.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    installName: "spawner",
    extensionId: "example.spawner",
    name: "spawner",
    displayName: "Spawner",
    sourcePath: join(root, "spawner"),
    sourceKind: "local_path",
    manifest: {},
  });

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "process-targets-")));
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  await writeTree();
  const source = join(root, "spawner");
  await mkdir(source);
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name: "spawner",
      version: "1.0.0",
      publisher: "example",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  await writeFile(join(source, "extension.ts"), entry);
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  for (const name of ["main", "other"] as const) {
    const project = await handle.deps.projectService.create({ name });
    projects[name] = project.id;
    const folder = join(root, name);
    await mkdir(folder);
    await writeFile(join(folder, "notes.txt"), `${name} notes`);
    const home = await handle.deps.workspaceService.ensureDefault({ project_id: project.id, root_path: folder, name });
    if (name === "other") workspaces.other = home.id;
    const installed = await enable(project.id);
    if (name === "main") instanceId = installed.instance.id;
  }
  workspaces.remote = await addRemoteWorkspace(projects.main, "remote");
  workspaces.bare = await addRemoteWorkspace(projects.main, "bare");
  workspaces.slow = await addRemoteWorkspace(projects.main, "slow");
  workspaces.late = await addRemoteWorkspace(projects.main, "late");
});

afterAll(async () => {
  if (!closed) await handle?.close();
  process.env.PSTDIO_HOME = previous.home;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
  await rm(root, { recursive: true, force: true });
});

const execute = async (projectId: string, command: string, params: Record<string, unknown>) => {
  const response = await handle.app.request(
    `/v1/projects/${projectId}/extensions/commands/example.spawner.command.${command}/execute`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ params }) },
  );
  return ((await response.json()) as { outcome: { ok: boolean; value: unknown; error?: unknown } }).outcome;
};
const spawn = async (params: Record<string, unknown>, projectId = projects.main) =>
  (await execute(projectId, "spawn", params)).value as { stdout: string; exit: unknown; startError: string | null };
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const waitFor = async (check: () => boolean, timeoutMs = 5_000) => {
  const until = Date.now() + timeoutMs;
  while (!check() && Date.now() < until) await Bun.sleep(20);
  return check();
};
const keep = async (projectId: string, marker: string) => {
  expect((await execute(projectId, "keep", { command: [process.execPath, join(root, "tree.ts"), marker] })).ok).toBe(
    true,
  );
  await waitFor(() => existsSync(marker) && readFileSync(marker, "utf8").length > 0);
  return JSON.parse(readFileSync(marker, "utf8")) as number[];
};

test("stopping a child while its remote provider is opening aborts the provider's signal", async () => {
  const entered = Promise.withResolvers<AbortSignal>();
  const pending = Promise.withResolvers<ProcessHandle>();
  const owner = createProcessOwner();
  const child = createProcessApi({
    callOwner: owner,
    resolveTarget: (workspaceId, signal) =>
      resolveProcessTarget(
        {
          ...handle.deps,
          workspaceProviderRuntime: {
            async find(deps, input) {
              const provider = await defaultWorkspaceProviderRuntime.find(deps, input);
              if (!provider) return;
              return {
                ...provider,
                provider: {
                  ...provider.provider,
                  spawn: (_context, input) => {
                    input.signal?.addEventListener("abort", () => pending.reject(input.signal.reason), { once: true });
                    entered.resolve(input.signal);
                    return pending.promise;
                  },
                },
              };
            },
          },
        },
        { projectId: projects.main, workspaceId },
        signal,
      ),
  }).spawn({ command: ["agent"], workspaceId: workspaces.late });

  try {
    const providerSignal = await entered.promise;
    expect(providerSignal?.aborted).toBe(false);
    await owner.close();
    expect(providerSignal.aborted).toBe(true);
    await expect(child.started).rejects.toMatchObject({ code: "process_owner_closed" });
    await owner.drained;
  } finally {
    pending.reject(new Error("Fixture closed"));
    await owner.close();
  }
});

test("a command's child runs in its project's workspace by default", async () => {
  const result = await spawn({ command: [process.execPath, "-e", "process.stdout.write(process.cwd())"] });
  expect(result).toEqual({ stdout: join(root, "main"), exit: { code: 0, signal: null }, startError: null });
});

test("a workspace of another project is rejected before anything starts", async () => {
  const marker = join(root, "cross-project");
  const result = await spawn({
    command: [process.execPath, "-e", `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ran")`],
    workspaceId: workspaces.other,
  });
  expect(result.startError).toBe("process_target_unavailable");
  expect(existsSync(marker)).toBe(false);
  await expect(
    readTargetText(handle.deps, { projectId: projects.main, workspaceId: workspaces.other, path: "notes.txt" }),
  ).rejects.toMatchObject({ code: "target_file_unavailable" });
});

test("a remote workspace's provider starts the child with its own context and providerRef; a cwd never runs locally", async () => {
  const before = seen().length;
  const result = await spawn({ command: ["agent", "serve"], cwd: "/srv/repo", workspaceId: workspaces.remote });
  expect(result).toEqual({ stdout: "ran remotely", exit: { code: 0, signal: null }, startError: null });
  expect(seen().slice(before)).toEqual([
    {
      extensionId: "example.spawner",
      projectId: projects.main,
      provider: true,
      input: {
        projectId: projects.main,
        workspaceId: workspaces.remote,
        providerRef,
        process: { command: ["agent", "serve"], cwd: "/srv/repo", workspaceId: workspaces.remote, lifetime: "call" },
      },
    },
  ]);
});

test("a remote workspace without provider support fails clearly instead of running here", async () => {
  const marker = join(root, "unsupported");
  const result = await spawn({
    command: [process.execPath, "-e", `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ran")`],
    cwd: root,
    workspaceId: workspaces.bare,
  });
  expect(result.startError).toBe("process_target_unsupported");
  expect(existsSync(marker)).toBe(false);
  await expect(
    readTargetText(handle.deps, { projectId: projects.main, workspaceId: workspaces.bare, path: "~/.claude/x.jsonl" }),
  ).rejects.toMatchObject({ code: "target_file_unsupported" });
});

test("a command that leaves a spawn opening on an unresponsive provider still ends, and the provider's call is closed", async () => {
  const outcome = await Promise.race([
    execute(projects.main, "fire", { command: ["agent"], workspaceId: workspaces.slow }),
    Bun.sleep(4_000).then(() => "hung"),
  ]);
  expect(outcome).toMatchObject({ ok: true, value: "returned" });
  // The provider's own context closed, so the helper it started for this child stopped too.
  const helper = (globalThis as { __slowProviderHelper?: ProcessHandle }).__slowProviderHelper!;
  expect(await Promise.race([helper.exited.then(() => "stopped"), Bun.sleep(3_000).then(() => "running")])).toBe(
    "stopped",
  );
});

test.each([
  "handle",
  "owner",
] as const)("a late remote child keeps its failing cleanup available to the %s", async (retryThrough) => {
  const owner = createProcessOwner();
  let drained = false;
  void owner.drained.then(() => {
    drained = true;
  });
  const entered = Promise.withResolvers<void>();
  const reply = Promise.withResolvers<ProcessHandle>();
  const stopping = Promise.withResolvers<void>();
  const rejectStop = Promise.withResolvers<void>();
  const remoteExit = Promise.withResolvers<ProcessExit>();
  const fixture = { entered: entered.resolve, reply: reply.promise, spawns: 0 };
  const context = globalThis as typeof globalThis & { __lateProvider?: typeof fixture };
  context.__lateProvider = fixture;
  const failure = new Error("The fixture target is temporarily unreachable.");
  let stops = 0;
  const remote: ProcessHandle = {
    id: "remote-fixture",
    started: Promise.resolve(),
    exited: remoteExit.promise,
    write: async () => {},
    end: async () => {},
    async kill() {
      if (++stops === 1) {
        stopping.resolve();
        await rejectStop.promise;
        throw failure;
      }
      remoteExit.resolve({ code: null, signal: "SIGKILL" });
    },
    events: async function* () {},
  };
  const child = createProcessApi({
    callOwner: owner,
    resolveTarget: (workspaceId, signal) =>
      resolveProcessTarget(handle.deps, { projectId: projects.main, workspaceId }, signal),
  }).spawn({ command: ["agent"], workspaceId: workspaces.late });
  try {
    await entered.promise;
    const firstClose = await Promise.race([owner.close().then(() => "closed"), Bun.sleep(300).then(() => "hung")]);
    expect(firstClose).toBe("closed");
    expect(drained).toBe(false);
    await expect(child.started).rejects.toMatchObject({ code: "process_owner_closed" });
    expect(await child.exited).toEqual({ code: null, signal: null });
    expect(stops).toBe(0);

    reply.resolve(remote);
    await stopping.promise;
    const stopAgain = retryThrough === "handle" ? child.kill : owner.close;
    const observed = stopAgain().then(
      () => "silently closed",
      (error: unknown) => error,
    );
    rejectStop.resolve();
    expect(await observed).toEqual(
      retryThrough === "handle" ? failure : expect.objectContaining({ errors: [failure] }),
    );
    await stopAgain();
    await expect(remote.exited).resolves.toEqual({ code: null, signal: "SIGKILL" });
    expect(fixture.spawns).toBe(1);
    expect(stops).toBe(2);
    await owner.drained;
  } finally {
    reply.resolve(remote);
    rejectStop.resolve();
    remoteExit.resolve({ code: null, signal: null });
    await owner.close().catch(() => {});
    delete context.__lateProvider;
  }
});

test("disposing a retired generation bounds a stuck provider stop and can retry it", async () => {
  const source = {
    extension_id: "example.spawner",
    source_path: join(root, "spawner"),
    source_hash: "fixture-source",
    manifest_json: {},
  };
  const owners = createExtensionProcessOwners({ findEnabledSource: async () => source });
  const entered = Promise.withResolvers<void>();
  const reply = Promise.withResolvers<ProcessHandle>();
  const stopStarted = Promise.withResolvers<void>();
  const remoteExit = Promise.withResolvers<ProcessExit>();
  const fixture = { entered: entered.resolve, reply: reply.promise, spawns: 0 };
  const context = globalThis as typeof globalThis & { __lateProvider?: typeof fixture };
  context.__lateProvider = fixture;
  let stops = 0;
  const remote: ProcessHandle = {
    id: "late-stuck-child",
    started: Promise.resolve(),
    exited: remoteExit.promise,
    write: async () => {},
    end: async () => {},
    async kill() {
      if (++stops === 1) {
        stopStarted.resolve();
        return new Promise<void>(() => {});
      }
      remoteExit.resolve({ code: null, signal: "SIGKILL" });
    },
    events: async function* () {},
  };
  const child = createProcessApi({
    extensionOwner: owners.capture(projects.main, "stalled-instance", source),
    resolveTarget: (workspaceId, signal) =>
      resolveProcessTarget(handle.deps, { projectId: projects.main, workspaceId }, signal),
  }).spawn({ command: ["agent"], workspaceId: workspaces.late, lifetime: "extension" });
  let confirmed = false;
  const cleanup = child.treeExited!.then(() => {
    confirmed = true;
  });
  try {
    await entered.promise;
    await owners.retireInstance("stalled-instance");
    await expect(child.started).rejects.toMatchObject({ code: "process_owner_closed" });
    reply.resolve(remote);
    await stopStarted.promise;

    const result = await Promise.race([owners.dispose().then(() => "disposed"), Bun.sleep(6_500).then(() => "hung")]);
    expect(result).toBe("disposed");
    expect(stops).toBe(1);
    expect(confirmed).toBe(false);

    await owners.dispose();
    await cleanup;
    expect(await remote.exited).toEqual({ code: null, signal: "SIGKILL" });
    expect(stops).toBe(2);
    expect(fixture.spawns).toBe(1);
  } finally {
    reply.resolve(remote);
    remoteExit.resolve({ code: null, signal: null });
    delete context.__lateProvider;
  }
}, 10_000);

test("target files read local paths relative to the workspace or the home, and remote ones through the provider", async () => {
  const read = (workspaceId: string, path: string) =>
    readTargetText(handle.deps, { projectId: projects.main, workspaceId, path });
  const home = await handle.deps.workspaceService.getDefault(projects.main);
  expect(await read(home!.id, "notes.txt")).toBe("main notes");
  expect(await read(home!.id, `~/${relative(homedir(), join(root, "main", "notes.txt"))}`)).toBe("main notes");
  const before = seen().length;
  expect(await read(workspaces.remote, "~/.claude/projects/s.jsonl")).toBe("remote text at ~/.claude/projects/s.jsonl");
  expect(seen().slice(before)).toMatchObject([
    { provider: true, input: { workspaceId: workspaces.remote, providerRef, path: "~/.claude/projects/s.jsonl" } },
  ]);
});

test("a still-running old command cannot start after identical source re-enable", async () => {
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const context = globalThis as typeof globalThis & { __delaySpawn?: object };
  context.__delaySpawn = { entered: entered.resolve, resume: resume.promise };
  const marker = join(root, "reenable-local-marker");
  const old = execute(projects.main, "delay-spawn", {
    command: [process.execPath, "-e", 'await Bun.write(process.argv[1], "ran")', marker],
  });
  try {
    await Promise.race([
      entered.promise,
      old.then((outcome) => {
        throw new Error(`The original command ended before disable: ${JSON.stringify(outcome)}`);
      }),
    ]);
    await handle.deps.extensionService.setProjectExtensionEnabled(instanceId, false);
    await handle.deps.extensionService.setProjectExtensionEnabled(instanceId, true);
    resume.resolve();
    const outcome = await old;
    expect(outcome).toMatchObject({ ok: true, value: "process_owner_closed" });
    expect(existsSync(marker)).toBe(false);
    const fresh = await spawn({
      command: [process.execPath, "-e", "process.stdout.write('new generation')"],
      lifetime: "extension",
    });
    expect(fresh).toEqual({ startError: null, stdout: "new generation", exit: { code: 0, signal: null } });
  } finally {
    resume.resolve();
    await old.catch(() => {});
    delete context.__delaySpawn;
  }
});

test("an extension-owned child survives its command and unchanged catalog rebuilds, and stops on disable", async () => {
  const pids = await keep(projects.main, join(root, "kept-main"));
  expect(pids.every(alive)).toBe(true);
  handle.deps.extensionRuntimeCatalog.invalidate({ projectId: projects.main, reason: "webviews_built" });
  await Bun.sleep(300);
  expect(pids.every(alive)).toBe(true);
  await handle.deps.extensionService.setProjectExtensionEnabled(instanceId, false);
  expect(await waitFor(() => !pids.some(alive))).toBe(true);
});

test("shutdown stops extension-owned children and retries late cleanup after disable", async () => {
  const pids = await keep(projects.other, join(root, "kept-other"));
  expect(pids.every(alive)).toBe(true);
  await handle.deps.extensionService.setProjectExtensionEnabled(instanceId, true);
  const dispatched = Promise.withResolvers<void>();
  const reply = Promise.withResolvers<ProcessHandle>();
  const cancelled = Promise.withResolvers<string>();
  const exited = Promise.withResolvers<ProcessExit>();
  const fixture = {
    entered: dispatched.resolve,
    dispatched: dispatched.promise,
    reply: reply.promise,
    spawns: 0,
    observe(started: Promise<void>) {
      void started.then(
        () => cancelled.resolve("started"),
        (error) => cancelled.resolve(error.code),
      );
    },
  };
  const context = globalThis as typeof globalThis & { __lateProvider?: typeof fixture };
  context.__lateProvider = fixture;
  let stops = 0;
  const remote: ProcessHandle = {
    id: "late-extension-child",
    started: Promise.resolve(),
    exited: exited.promise,
    write: async () => {},
    end: async () => {},
    async kill() {
      if (++stops === 1) throw new Error("The fixture could not stop the remote child yet.");
      exited.resolve({ code: null, signal: "SIGKILL" });
    },
    events: async function* () {},
  };
  try {
    const outcome = await execute(projects.main, "fire-extension", {
      command: ["agent"],
      workspaceId: workspaces.late,
    });
    expect(outcome).toMatchObject({ ok: true, value: "returned" });
    await handle.deps.extensionService.setProjectExtensionEnabled(instanceId, false);
    expect(await Promise.race([cancelled.promise, Bun.sleep(3_000).then(() => "hung")])).toBe("process_owner_closed");
    expect(stops).toBe(0);

    reply.resolve(remote);
    expect(await waitFor(() => stops === 1, 1_000)).toBe(true);
    closed = true;
    await handle.close();
    expect(stops).toBe(2);
    expect(fixture.spawns).toBe(1);
    expect(await exited.promise).toEqual({ code: null, signal: "SIGKILL" });
    expect(await waitFor(() => !pids.some(alive))).toBe(true);
  } finally {
    reply.resolve(remote);
    exited.resolve({ code: null, signal: null });
    delete context.__lateProvider;
  }
});
