import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionProcessEnvironment, createInvocationScope, type InvocationScope } from "pstdio-extensions";
import { expectRejection } from "../../test-utils/expect-rejection";
import { createProcessApi } from "./extension-process-api";
import { createProcessEnvironmentPermissions, type ProcessEnvironmentSource } from "./process-environment/permissions";
import { spawnProcessHandle } from "./process-handle";

const TOKEN = "host-only-agent-credential";
let root: string;
const previous = process.env.EXTENSION_AGENT_TOKEN;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "process-env-from-host-"));
  process.env.EXTENSION_AGENT_TOKEN = TOKEN;
});

afterAll(() => {
  if (previous === undefined) delete process.env.EXTENSION_AGENT_TOKEN;
  else process.env.EXTENSION_AGENT_TOKEN = previous;
  rmSync(root, { recursive: true, force: true });
});

const source: ProcessEnvironmentSource = {
  extension_id: "acme.agent",
  source_path: "/extensions/agent",
  source_hash: "hash-1",
  manifest_json: { pstdio: { processEnvironment: ["EXTENSION_AGENT_TOKEN", "EXTENSION_MISSING_TOKEN"] } },
};

const setup = async (grant: string[] = [], scope?: InvocationScope) => {
  const permissions = createProcessEnvironmentPermissions({
    path: join(root, `${crypto.randomUUID()}.json`),
    findSource: async () => source,
  });
  if (grant.length) {
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: grant, sourceIdentity });
  }
  const api = createProcessApi({
    extensionId: "acme.agent",
    hostEnvironment: (names) => permissions.authorize("project-1", source, names),
    scope,
  });
  return { api, permissions };
};

// The child writes what it received to a file, so a test can tell whether it started at all.
const reporter = (marker: string, extra = "") => [
  process.execPath,
  "-e",
  `require("node:fs").writeFileSync(${JSON.stringify(marker)}, process.env.EXTENSION_AGENT_TOKEN ?? "absent"); ${extra}`,
];

describe("process environment preparation", () => {
  test.each([
    "run",
    "spawnDetached",
  ] as const)("%s does not spawn after its invocation ends while preparing the environment", async (method) => {
    const scope = createInvocationScope({ logger: { info() {}, warn() {}, error() {} } });
    const started = Promise.withResolvers<void>();
    const names = Promise.withResolvers<string[]>();
    const api = createProcessApi({
      scope,
      grantedNames: () => {
        started.resolve();
        return names.promise;
      },
      spawner: () => {
        throw new Error("Reached the spawner after the invocation ended");
      },
    });
    const result = api[method]({ command: [process.execPath] }).catch((error: unknown) => error);
    await started.promise;
    await scope.close();
    names.resolve([]);
    expect(await result).toMatchObject({ message: "Invocation ended before the command could start." });
  });
});

describe("envFromHost", () => {
  test("a denied name starts no child", async () => {
    const { api } = await setup();
    const marker = join(root, "denied");

    await expectRejection(api.run({ command: reporter(marker), envFromHost: ["EXTENSION_AGENT_TOKEN"] })).toMatchObject(
      {
        code: "process_environment_not_granted",
      },
    );
    expect(existsSync(marker)).toBe(false);
  });

  test("a granted name reaches only the child, and its value is not returned to the extension", async () => {
    const { api } = await setup(["EXTENSION_AGENT_TOKEN"]);
    const marker = join(root, "granted");

    const result = await api.run({
      command: reporter(marker, "console.log(process.env.EXTENSION_AGENT_TOKEN)"),
      envFromHost: ["EXTENSION_AGENT_TOKEN"],
    });

    expect(readFileSync(marker, "utf8")).toBe(TOKEN);
    expect(result.exitCode).toBe(0);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  test("run and runOrThrow hide overlapping fixture values from both streams", async () => {
    const original = process.env.EXTENSION_AGENT_TOKEN;
    const other = process.env.EXTENSION_MISSING_TOKEN;
    process.env.EXTENSION_AGENT_TOKEN = "abc";
    process.env.EXTENSION_MISSING_TOKEN = "bcdefg";
    try {
      const names = ["EXTENSION_AGENT_TOKEN", "EXTENSION_MISSING_TOKEN"];
      const { api } = await setup(names);
      const input = {
        command: [process.execPath, "-e", 'console.log("abcdefg"); console.error("abcdefg"); process.exit(1)'],
        envFromHost: names,
      };
      const result = await api.run(input);
      expect(result).toEqual({ exitCode: 1, stdout: "[Redacted]\n", stderr: "[Redacted]\n" });
      const error = await api.runOrThrow(input).catch((error: unknown) => error);
      expect(error).toMatchObject({ message: "[Redacted]\n[Redacted]" });
    } finally {
      if (original === undefined) delete process.env.EXTENSION_AGENT_TOKEN;
      else process.env.EXTENSION_AGENT_TOKEN = original;
      if (other === undefined) delete process.env.EXTENSION_MISSING_TOKEN;
      else process.env.EXTENSION_MISSING_TOKEN = other;
    }
  });

  test("a child without envFromHost does not receive a granted value", async () => {
    const { api } = await setup(["EXTENSION_AGENT_TOKEN"]);
    const marker = join(root, "not-requested");

    await api.run({ command: reporter(marker) });

    expect(readFileSync(marker, "utf8")).toBe("absent");
  });

  test("explicit env cannot replace a requested host value", async () => {
    const { api } = await setup(["EXTENSION_AGENT_TOKEN"]);
    const marker = join(root, "override");

    await expectRejection(
      api.run({
        command: reporter(marker),
        env: { EXTENSION_AGENT_TOKEN: "forged" },
        envFromHost: ["EXTENSION_AGENT_TOKEN"],
      }),
    ).toThrow("envFromHost");
    expect(existsSync(marker)).toBe(false);
  });

  test("a granted name the host does not have is reported instead of starting the child", async () => {
    const { api } = await setup(["EXTENSION_MISSING_TOKEN"]);
    const marker = join(root, "missing");

    await expectRejection(
      api.run({ command: reporter(marker), envFromHost: ["EXTENSION_MISSING_TOKEN"] }),
    ).toMatchObject({
      code: "process_environment_unavailable",
    });
    expect(existsSync(marker)).toBe(false);
  });

  test("a host-level process API without a permission owner refuses envFromHost", async () => {
    const marker = join(root, "unowned");

    await expectRejection(
      createProcessApi().run({ command: reporter(marker), envFromHost: ["EXTENSION_AGENT_TOKEN"] }),
    ).toMatchObject({ code: "process_environment_not_granted" });
    expect(existsSync(marker)).toBe(false);
  });

  test("revoking stops a running child that received the grant", async () => {
    const { api, permissions } = await setup(["EXTENSION_AGENT_TOKEN"]);
    const marker = join(root, "long-running");
    const outcome = api
      .run({ command: reporter(marker, "setInterval(() => {}, 1000)"), envFromHost: ["EXTENSION_AGENT_TOKEN"] })
      .then(
        () => "finished",
        (error: Error) => error.message,
      );
    while (!existsSync(marker)) await Bun.sleep(10);

    await permissions.revoke("project-1", "acme.agent");

    expect(await outcome).toContain("revoked");
  });

  test("a detached child receives the grant and is stopped when it is revoked", async () => {
    const { api, permissions } = await setup(["EXTENSION_AGENT_TOKEN"]);
    const marker = join(root, "detached");

    const { pid } = await api.spawnDetached({
      command: reporter(marker, "setInterval(() => {}, 1000)"),
      envFromHost: ["EXTENSION_AGENT_TOKEN"],
    });
    while (!existsSync(marker)) await Bun.sleep(10);
    expect(readFileSync(marker, "utf8")).toBe(TOKEN);

    await permissions.revoke("project-1", "acme.agent");

    expect(() => process.kill(pid!, 0)).toThrow();
  });

  test.each([
    ["run", "revoke"],
    ["spawnDetached", "revoke"],
    ["spawn", "revoke"],
    ["spawn", "invocation close"],
  ] as const)("%s stops descendants after the launcher exits on %s", async (method, stop) => {
    const scope = createInvocationScope({ logger: { info() {}, warn() {}, error() {} } });
    const names = stop === "revoke" ? ["EXTENSION_AGENT_TOKEN"] : [];
    const { api, permissions } = await setup(names, scope);
    const fixtureId = crypto.randomUUID();
    const marker = join(root, `${fixtureId}-background`);
    const launcherMarker = join(root, `${fixtureId}-launcher`);
    const background = `require("node:fs").writeFileSync(${JSON.stringify(marker)}, String(process.pid)); setInterval(() => {}, 1000)`;
    const waitFor = async (ready: () => boolean, phase: string) => {
      const deadline = Date.now() + 5_000;
      while (!ready()) {
        if (Date.now() >= deadline) throw new Error(`${method}: timed out waiting for ${phase}`);
        await Bun.sleep(10);
      }
    };
    const alive = (pid: number) => {
      if (process.platform !== "win32") {
        // Signal 0 can report a defunct process as present until its parent reaps the PID.
        const state = Bun.spawnSync(["ps", "-p", String(pid), "-o", "stat="])
          .stdout.toString()
          .trim();
        return state !== "" && !state.startsWith("Z");
      }
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };

    let backgroundPid: number | undefined;
    let revoked = false;
    try {
      const execution = api[method]({
        command: [
          process.execPath,
          "-e",
          `
          const fs = require("node:fs");
          fs.writeFileSync(${JSON.stringify(launcherMarker)}, String(process.pid));
          // Windows' ordinary child-process launcher owns a kill-on-close job. Detach the fixture
          // from that launcher while retaining the host's outer Job, so it can outlive its parent.
          require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(background)}], {
            stdio: "ignore", detached: process.platform === "win32",
          }).unref();
          const deadline = Date.now() + 5_000;
          while (!fs.existsSync(${JSON.stringify(marker)}) || !fs.readFileSync(${JSON.stringify(marker)}, "utf8")) {
            if (Date.now() >= deadline) throw new Error("Background fixture did not become ready before launcher exit.");
            await Bun.sleep(10);
          }
        `,
        ],
        envFromHost: names,
      });
      const result = "exited" in execution ? await execution.exited : await execution;
      await waitFor(() => existsSync(marker) && readFileSync(marker, "utf8") !== "", "the background PID marker");
      backgroundPid = Number(readFileSync(marker, "utf8"));
      const launcherPid = Number(readFileSync(launcherMarker, "utf8"));
      expect(Number.isSafeInteger(launcherPid) && launcherPid > 0).toBe(true);
      expect(Number.isSafeInteger(backgroundPid) && backgroundPid > 0).toBe(true);
      if ("code" in result) expect(result).toEqual({ code: 0, signal: null });
      else if ("exitCode" in result) expect(result.exitCode).toBe(0);
      else expect(result.pid).toBe(launcherPid);
      await waitFor(() => !alive(launcherPid), "the launcher to exit");
      expect(alive(backgroundPid)).toBe(true);

      if (stop === "revoke") {
        await permissions.revoke("project-1", "acme.agent");
        revoked = true;
      } else await scope.close();

      expect(alive(backgroundPid)).toBe(false);
    } finally {
      if (stop === "revoke" && !revoked) await permissions.revoke("project-1", "acme.agent").catch(() => {});
      await scope.close();
      if (backgroundPid && Number.isSafeInteger(backgroundPid) && backgroundPid > 0 && alive(backgroundPid))
        process.kill(backgroundPid, "SIGKILL");
    }
  });
});

type PipeOptions = NonNullable<Parameters<typeof Bun.spawn<"pipe", "pipe", "pipe">>[1]>;

const pauseWindowsStartup = () => {
  const ready = Promise.withResolvers<{ targetPid: number; launcherPid: number }>();
  let confirm = () => {};
  const spawner = ((argv: string[], options: PipeOptions) =>
    Bun.spawn(argv, {
      ...options,
      ipc: (message, launcher) => {
        if (typeof message?.pid !== "number") {
          ready.reject(new Error("The test launcher did not report a target PID."));
          return;
        }
        confirm = () => {
          if (typeof options.ipc === "function") options.ipc(message, launcher);
        };
        ready.resolve({ targetPid: message.pid, launcherPid: launcher.pid });
      },
    })) as typeof Bun.spawn;
  const timeout = Promise.withResolvers<never>();
  const waitForTarget = async () => {
    const timer = setTimeout(
      () => timeout.reject(new Error("The test launcher did not acknowledge the target.")),
      5_000,
    );
    try {
      return await Promise.race([ready.promise, timeout.promise]);
    } finally {
      clearTimeout(timer);
    }
  };
  return { spawner, waitForTarget, confirm: () => confirm() };
};

const windowsSpawn = (code: string, spawner?: typeof Bun.spawn) =>
  spawnProcessHandle({ argv: [process.execPath, "-e", code], env: createExtensionProcessEnvironment() }, { spawner });

test.skipIf(process.platform !== "win32")(
  "a Windows stream waits for target acknowledgement and carries binary stdin, stdout and stderr",
  async () => {
    const startup = pauseWindowsStartup();
    const handle = windowsSpawn(
      `for await (const bytes of Bun.stdin.stream()) process.stdout.write(bytes);
process.stderr.write("stdin closed");`,
      startup.spawner,
    );
    let started = false;
    void handle.started.then(
      () => {
        started = true;
      },
      () => {},
    );
    try {
      const output = Array.fromAsync(handle.events());
      const first = handle.write(new Uint8Array([0, 255, 65]));
      const second = handle.write(new Uint8Array([66, 0, 67]));
      const written = Promise.all([first, second, handle.end()]);
      void written.catch(() => {});
      const { targetPid, launcherPid } = await startup.waitForTarget();
      expect(Number.isSafeInteger(targetPid) && targetPid > 0).toBe(true);
      expect(targetPid).not.toBe(launcherPid);
      expect(started).toBe(false);
      startup.confirm();
      await Promise.all([handle.started, written]);
      const events = await output;
      const bytes = (type: "stdout" | "stderr") =>
        Buffer.concat(events.flatMap((event) => (event.type === type ? [event.data] : [])));
      expect([...bytes("stdout")]).toEqual([0, 255, 65, 66, 0, 67]);
      expect(bytes("stderr").toString()).toBe("stdin closed");
      expect(await handle.exited).toEqual({ code: 0, signal: null });
      expect(events.at(-1)).toEqual({ type: "exit", exit: { code: 0, signal: null } });
    } finally {
      await handle.kill("SIGKILL");
    }
  },
);

test.skipIf(process.platform !== "win32")(
  "Windows kill stops the whole streaming Job before startup acknowledgement",
  async () => {
    const startup = pauseWindowsStartup();
    const handle = windowsSpawn("setInterval(() => {}, 1000)", startup.spawner);
    try {
      const { targetPid, launcherPid } = await startup.waitForTarget();
      expect(Number.isSafeInteger(targetPid) && targetPid > 0 && targetPid !== launcherPid).toBe(true);
      await handle.kill();
      expect(() => process.kill(targetPid, 0)).toThrow();
      expect(
        await handle.started.then(
          () => "started",
          (error: unknown) => error,
        ),
      ).toMatchObject({
        code: "process_owner_closed",
      });
      expect(await handle.exited).toEqual({ code: null, signal: null });
      expect(await Array.fromAsync(handle.events())).toEqual([{ type: "exit", exit: { code: null, signal: null } }]);
    } finally {
      await handle.kill("SIGKILL");
    }
  },
);

test.skipIf(process.platform !== "win32")(
  "a Windows launcher whose target cannot start still finishes the stream",
  async () => {
    const handle = spawnProcessHandle({
      argv: [process.execPath, "--version"],
      cwd: join(root, crypto.randomUUID(), "missing"),
      env: createExtensionProcessEnvironment(),
    });
    try {
      expect(
        await handle.started.then(
          () => "started",
          (error: unknown) => error,
        ),
      ).toMatchObject({
        code: "process_target_unavailable",
      });
      expect(await handle.exited).toEqual({ code: null, signal: null });
      expect(await Array.fromAsync(handle.events())).toEqual([{ type: "exit", exit: { code: null, signal: null } }]);
    } finally {
      await handle.kill("SIGKILL");
    }
  },
);

test.skipIf(process.platform !== "win32")(
  "a missing Windows executable is reported distinctly from an invalid directory",
  async () => {
    const handle = spawnProcessHandle({
      argv: [join(root, `${crypto.randomUUID()}.exe`)],
      cwd: root,
      env: createExtensionProcessEnvironment(),
    });
    try {
      expect(
        await handle.started.then(
          () => "started",
          (error: unknown) => error,
        ),
      ).toMatchObject({
        code: "process_command_not_found",
      });
      expect(await handle.exited).toEqual({ code: null, signal: null });
      expect(await Array.fromAsync(handle.events())).toEqual([{ type: "exit", exit: { code: null, signal: null } }]);
    } finally {
      await handle.kill("SIGKILL");
    }
  },
);
