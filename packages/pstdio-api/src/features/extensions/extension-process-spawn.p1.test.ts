import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProcessEvent, ProcessHandle, ProcessSpawnInput } from "pstdio-api-contracts/extension-kernel";
import { createInvocationScope, createProcessOwner, processError } from "pstdio-extensions";
import { createProcessApi } from "./extension-process-api";
import { createExtensionProcessOwners } from "./extension-process-owners";
import { createProcessEnvironmentPermissions, type ProcessEnvironmentSource } from "./process-environment/permissions";

const TOKEN = "spawned-agent-credential";
const logger = { info: () => {}, warn: () => {}, error: () => {} };
let root: string;
const previous = { token: process.env.SPAWN_AGENT_TOKEN, secret: process.env.SPAWN_UNRELATED_SECRET };

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "process-spawn-")));
  process.env.SPAWN_AGENT_TOKEN = TOKEN;
  process.env.SPAWN_UNRELATED_SECRET = "must-not-reach-children";
  await mkdir(join(root, "workspace", "sub"), { recursive: true });
  await writeFile(
    join(root, "echo.ts"),
    `for await (const chunk of Bun.stdin.stream()) process.stdout.write(new TextDecoder().decode(chunk).toUpperCase());
process.stderr.write("done");`,
  );
  // Writes its pid and keeps running with a grandchild, so a test can tell whether the tree was stopped.
  await writeFile(
    join(root, "tree.ts"),
    `const grandchild = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], { stdout: "inherit", stderr: "inherit" });
await Bun.write(process.argv[2], JSON.stringify([process.pid, grandchild.pid]));
setInterval(() => {}, 1000);`,
  );
  await writeFile(
    join(root, "leader-exits.ts"),
    `const child = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], { stdout: "inherit", stderr: "inherit" });
await Bun.write(process.argv[2], JSON.stringify([child.pid]));
process.exit(0);`,
  );
});

afterAll(async () => {
  for (const [name, value] of [
    ["SPAWN_AGENT_TOKEN", previous.token],
    ["SPAWN_UNRELATED_SECRET", previous.secret],
  ] as const)
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  await rm(root, { recursive: true, force: true });
});

const bun = (script: string, ...args: string[]) => [process.execPath, join(root, script), ...args];
const collect = async (events: AsyncIterable<ProcessEvent>) => {
  const seen: ProcessEvent[] = [];
  for await (const event of events) seen.push(event);
  return seen;
};
const text = (events: ProcessEvent[], type: "stdout" | "stderr") =>
  events.flatMap((event) => (event.type === type ? [new TextDecoder().decode(event.data)] : [])).join("");
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
const treeOf = async (marker: string) => {
  await waitFor(() => existsSync(marker) && readFileSync(marker, "utf8").length > 0);
  return JSON.parse(readFileSync(marker, "utf8")) as number[];
};
const local =
  (path = join(root, "workspace")) =>
  async () => ({ kind: "local" as const, root: path });

test("a spawned child receives incremental stdin and streams both outputs before its final exit", async () => {
  const scope = createInvocationScope({ logger });
  const handle = createProcessApi({ scope }).spawn({ command: bun("echo.ts") });
  const output = collect(handle.events());
  await handle.write("hello ");
  await handle.write(new TextEncoder().encode("world"));
  await handle.end();
  await handle.started;
  const events = await output;
  expect(text(events, "stdout")).toBe("HELLO WORLD");
  expect(text(events, "stderr")).toBe("done");
  expect(events.at(-1)).toEqual({ type: "exit", exit: { code: 0, signal: null } });
  await scope.close();
});

test("closing the invocation stops a call-owned child and its descendants", async () => {
  const scope = createInvocationScope({ logger });
  const marker = join(root, "call-tree");
  const handle = createProcessApi({ scope }).spawn({ command: bun("tree.ts", marker) });
  const pids = await treeOf(marker);
  expect(pids.every(alive)).toBe(true);
  await scope.close();
  expect(await handle.exited).toMatchObject({ code: process.platform === "win32" ? 1 : null });
  expect(await waitFor(() => !pids.some(alive))).toBe(true);
});

test("a spawn after its owner closed fails with a code, settles exited and ends events, with no stray rejection", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    const scope = createInvocationScope({ logger });
    const api = createProcessApi({ scope });
    await scope.close();
    const marker = join(root, "late");
    const handle = api.spawn({ command: bun("tree.ts", marker) });
    await expect(handle.started).rejects.toMatchObject({ code: "process_owner_closed" });
    expect(await handle.exited).toEqual({ code: null, signal: null });
    expect(await collect(handle.events())).toEqual([{ type: "exit", exit: { code: null, signal: null } }]);
    // Observing only `exited` must not leave a rejected promise behind.
    api.spawn({ command: [] }).exited;
    await Bun.sleep(50);
    expect(existsSync(marker)).toBe(false);
    expect(unhandled).toEqual([]);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

test("an extension-owned child outlives its call and stops when the extension lifetime ends", async () => {
  const scope = createInvocationScope({ logger });
  const extensionOwner = createProcessOwner();
  const api = createProcessApi({ scope, extensionOwner: () => extensionOwner });
  const marker = join(root, "extension-tree");
  const handle = api.spawn({ command: bun("tree.ts", marker), lifetime: "extension" });
  const pids = await treeOf(marker);
  await scope.close();
  await Bun.sleep(100);
  expect(pids.every(alive)).toBe(true);
  await extensionOwner.close();
  expect(await handle.exited).toMatchObject({ code: process.platform === "win32" ? 1 : null });
  expect(await waitFor(() => !pids.some(alive))).toBe(true);
});

test("extension lifetime is refused where nothing owns it", async () => {
  const handle = createProcessApi({ scope: createInvocationScope({ logger }) }).spawn({
    command: bun("echo.ts"),
    lifetime: "extension",
  });
  await expect(handle.started).rejects.toMatchObject({ code: "process_owner_closed" });
});

test("a local child gets only the safe base environment and explicit values, in the selected workspace", async () => {
  const api = createProcessApi({ scope: createInvocationScope({ logger }), resolveTarget: local() });
  const handle = api.spawn({
    command: [
      process.execPath,
      "-e",
      "process.stdout.write(JSON.stringify({ cwd: process.cwd(), explicit: process.env.EXPLICIT_VALUE, secret: process.env.SPAWN_UNRELATED_SECRET ?? null }))",
    ],
    cwd: "sub",
    env: { EXPLICIT_VALUE: "given" },
  });
  const result = JSON.parse(text(await collect(handle.events()), "stdout"));
  expect(result).toEqual({ cwd: join(root, "workspace", "sub"), explicit: "given", secret: null });
});

test("a remote target receives the request and an explicit cwd never starts a local child", async () => {
  let localSpawns = 0;
  const requests: ProcessSpawnInput[] = [];
  // Stands in for the provider's handle, which the provider starts with its own context.
  const remote: ProcessHandle = createProcessApi({ scope: createInvocationScope({ logger }) }).spawn({
    command: [process.execPath, "-e", "process.stdout.write('remote')"],
  });
  const api = createProcessApi({
    scope: createInvocationScope({ logger }),
    resolveTarget: async () => ({
      kind: "remote",
      spawn: async (input) => {
        requests.push(input);
        return remote;
      },
    }),
    spawner: ((...args: Parameters<typeof Bun.spawn>) => {
      localSpawns += 1;
      return Bun.spawn(...args);
    }) as typeof Bun.spawn,
  });
  const handle = api.spawn({ command: ["agent", "--serve"], cwd: "/srv/remote/repo", workspaceId: "ws-remote" });
  expect(text(await collect(handle.events()), "stdout")).toBe("remote");
  expect(requests).toEqual([
    { command: ["agent", "--serve"], cwd: "/srv/remote/repo", workspaceId: "ws-remote", lifetime: "call" },
  ]);
  expect(localSpawns).toBe(0);

  const withHostValues = api.spawn({
    command: ["agent"],
    workspaceId: "ws-remote",
    envFromHost: ["SPAWN_AGENT_TOKEN"],
  });
  await expect(withHostValues.started).rejects.toMatchObject({ code: "process_target_unsupported" });
  expect(requests).toHaveLength(1);
});

test("an unsupported target fails clearly before anything starts", async () => {
  let localSpawns = 0;
  const api = createProcessApi({
    scope: createInvocationScope({ logger }),
    resolveTarget: async () => {
      throw processError("process_target_unsupported", "The provider cannot start processes.");
    },
    spawner: (() => {
      localSpawns += 1;
      throw new Error("unexpected local spawn");
    }) as unknown as typeof Bun.spawn,
  });
  const handle = api.spawn({ command: ["agent"], workspaceId: "ws-remote" });
  await expect(handle.started).rejects.toMatchObject({ code: "process_target_unsupported" });
  expect(await handle.exited).toEqual({ code: null, signal: null });
  expect(localSpawns).toBe(0);
});

test("a granted host value reaches the child but not the streamed output, even split across writes", async () => {
  const source: ProcessEnvironmentSource = {
    extension_id: "acme.agent",
    source_path: "/extensions/agent",
    source_hash: "hash-1",
    manifest_json: { pstdio: { processEnvironment: ["SPAWN_AGENT_TOKEN"] } },
  };
  const permissions = createProcessEnvironmentPermissions({
    path: join(root, "grants.json"),
    findSource: async () => source,
  });
  const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
  await permissions.grant("project-1", "acme.agent", { names: ["SPAWN_AGENT_TOKEN"], sourceIdentity });
  const api = createProcessApi({
    scope: createInvocationScope({ logger }),
    hostEnvironment: (names) => permissions.authorize("project-1", source, names),
  });
  const marker = join(root, "granted");
  const script = `const token = process.env.SPAWN_AGENT_TOKEN;
require("node:fs").writeFileSync(${JSON.stringify(marker)}, token);
process.stdout.write("a" + token.slice(0, 5));
await Bun.sleep(50);
process.stdout.write(token.slice(5) + "b");`;
  const handle = api.spawn({ command: [process.execPath, "-e", script], envFromHost: ["SPAWN_AGENT_TOKEN"] });
  const stdout = text(await collect(handle.events()), "stdout");
  expect(readFileSync(marker, "utf8")).toBe(TOKEN);
  expect(stdout).toBe("a[Redacted]b");
});

test("revoking a grant stops a spawned child that received it", async () => {
  const source: ProcessEnvironmentSource = {
    extension_id: "acme.agent",
    source_path: "/extensions/agent",
    source_hash: "hash-1",
    manifest_json: { pstdio: { processEnvironment: ["SPAWN_AGENT_TOKEN"] } },
  };
  const permissions = createProcessEnvironmentPermissions({
    path: join(root, "revoke-grants.json"),
    findSource: async () => source,
  });
  const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
  await permissions.grant("project-1", "acme.agent", { names: ["SPAWN_AGENT_TOKEN"], sourceIdentity });
  const api = createProcessApi({
    scope: createInvocationScope({ logger }),
    hostEnvironment: (names) => permissions.authorize("project-1", source, names),
  });
  const marker = join(root, "revoked-tree");
  const handle = api.spawn({ command: bun("tree.ts", marker), envFromHost: ["SPAWN_AGENT_TOKEN"] });
  const pids = await treeOf(marker);
  await permissions.revoke("project-1", "acme.agent");
  expect(await handle.exited).toMatchObject({ code: process.platform === "win32" ? 1 : null });
  expect(await waitFor(() => !pids.some(alive))).toBe(true);
});

test("an extension-owned child starts even when its call returns before the target resolves", async () => {
  const scope = createInvocationScope({ logger });
  const extensionOwner = createProcessOwner();
  const api = createProcessApi({
    scope,
    extensionOwner: () => extensionOwner,
    resolveTarget: async () => {
      await Bun.sleep(50);
      return { kind: "local", root: join(root, "workspace") };
    },
  });
  const marker = join(root, "returned-early");
  // The handler does not await `started` before its invocation ends.
  const handle = api.spawn({ command: bun("tree.ts", marker), lifetime: "extension" });
  await scope.close();
  await handle.started;
  const pids = await treeOf(marker);
  expect(pids.every(alive)).toBe(true);
  await extensionOwner.close();
  expect(await waitFor(() => !pids.some(alive))).toBe(true);
});

test("closing an owner does not wait for a target that is still opening, and a late target starts nothing", async () => {
  const scope = createInvocationScope({ logger });
  const target = Promise.withResolvers<{ kind: "local"; root: string }>();
  let targetSignal: AbortSignal | undefined;
  let localSpawns = 0;
  const api = createProcessApi({
    scope,
    resolveTarget: (_workspaceId, signal) => {
      targetSignal = signal;
      return target.promise;
    },
    spawner: ((...args: Parameters<typeof Bun.spawn>) => {
      localSpawns += 1;
      return Bun.spawn(...args);
    }) as typeof Bun.spawn,
  });
  const marker = join(root, "run-beside-pending-spawn");
  const running = api.run({ command: bun("tree.ts", marker) }).then(
    () => "finished",
    () => "stopped",
  );
  const pids = await treeOf(marker);
  const handle = api.spawn({ command: bun("echo.ts") });
  const closed = await Promise.race([scope.close().then(() => "closed"), Bun.sleep(3_000).then(() => "hung")]);
  expect(closed).toBe("closed");
  expect(await running).toBe("stopped");
  expect(await waitFor(() => !pids.some(alive))).toBe(true);
  expect(targetSignal?.aborted).toBe(true);
  await expect(handle.started).rejects.toMatchObject({ code: "process_owner_closed" });
  expect(await handle.exited).toEqual({ code: null, signal: null });
  target.resolve({ kind: "local", root: join(root, "workspace") });
  await Bun.sleep(100);
  // The run above is the only child that ever started.
  expect(localSpawns).toBe(1);
});

test.skipIf(process.platform === "win32")(
  "invocation cleanup stops the process group after its leader exited",
  async () => {
    const scope = createInvocationScope({ logger });
    const marker = join(root, "natural-parent-exit");
    const handle = createProcessApi({ scope }).spawn({ command: bun("leader-exits.ts", marker) });
    const [pid] = await treeOf(marker);
    try {
      expect(await handle.exited).toEqual({ code: 0, signal: null });
      expect(alive(pid!)).toBe(true);
      await scope.close();
      // The OS can briefly retain the terminated descendant's PID while reaping it.
      expect(await waitFor(() => !alive(pid!), 1_000)).toBe(true);
      expect(await collect(handle.events())).toEqual([{ type: "exit", exit: { code: 0, signal: null } }]);
    } finally {
      if (pid && alive(pid)) process.kill(pid, "SIGKILL");
    }
  },
);

test("a process from a retired source cannot open its target before eligibility is known", async () => {
  const enabled = Promise.withResolvers<undefined>();
  const owners = createExtensionProcessOwners({ findEnabledSource: () => enabled.promise });
  const scope = createInvocationScope({ logger });
  const source = { extension_id: "acme.stale", source_path: root, source_hash: "retired", manifest_json: {} };
  let targetOpened = false;
  const api = createProcessApi({
    scope,
    extensionOwner: owners.capture("retired-project", "fixture-instance", source),
    resolveTarget: async () => {
      targetOpened = true;
      return { kind: "local", root };
    },
  });
  try {
    const child = api.spawn({ command: bun("echo.ts"), lifetime: "extension" });
    await Bun.sleep(0);
    enabled.resolve(undefined);
    expect(
      await child.started.then(
        () => "started",
        (error) => error.code,
      ),
    ).toBe("process_owner_closed");
    expect(targetOpened).toBe(false);
  } finally {
    enabled.resolve(undefined);
    await owners.dispose();
    await scope.close();
  }
});

test.skipIf(process.platform === "win32")(
  "a locally admitted child stays owned if cleanup fails before the public handle opens",
  async () => {
    const owner = createProcessOwner();
    const slot = Promise.withResolvers<{ firstClose: Promise<unknown> }>();
    let physicalChild: ReturnType<typeof Bun.spawn<"pipe", "pipe", "pipe">> | undefined;
    let stopAllowed = false;
    let stopAttempts = 0;
    const api = createProcessApi({
      callOwner: owner,
      spawner: (() => {
        // This private fixture is in the test's group, so only the stand-in's kill owns its stop.
        const child = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
          detached: false,
        });
        physicalChild = child;
        queueMicrotask(() => {
          slot.resolve({
            firstClose: owner.close().then(
              () => "silently closed",
              (error: unknown) => error,
            ),
          });
        });
        return {
          pid: child.pid,
          stdin: child.stdin,
          stdout: child.stdout,
          stderr: child.stderr,
          exited: child.exited,
          get signalCode() {
            return child.signalCode;
          },
          kill() {
            stopAttempts++;
            if (stopAllowed) child.kill("SIGKILL");
          },
        };
      }) as unknown as typeof Bun.spawn,
    });
    const handle = api.spawn({ command: [process.execPath, "-e", "setInterval(() => {}, 1000)"] });
    try {
      const { firstClose } = await slot.promise;
      expect(await firstClose).toMatchObject({
        message: "Owned process cleanup failed.",
        errors: [{ message: "The process tree did not stop." }],
      });
      expect(owner.closed).toBe(true);
      expect(stopAttempts).toBeGreaterThan(0);
      expect(alive(physicalChild!.pid)).toBe(true);
      stopAllowed = true;
      await owner.close();
      await physicalChild!.exited;
      expect(alive(physicalChild!.pid)).toBe(false);
    } finally {
      stopAllowed = true;
      physicalChild?.kill("SIGKILL");
      await physicalChild?.exited;
      await handle.exited;
    }
  },
);
