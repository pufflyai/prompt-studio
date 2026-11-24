import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInvocationScope, createProcessOwner } from "pstdio-extensions";
import { createProcessApi } from "./extension-process-api";
import { createProcessEnvironmentPermissions, type ProcessEnvironmentSource } from "./process-environment/permissions";

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

const setup = async (grant: string[] = []) => {
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

    await expect(api.run({ command: reporter(marker), envFromHost: ["EXTENSION_AGENT_TOKEN"] })).rejects.toMatchObject({
      code: "process_environment_not_granted",
    });
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

    await expect(
      api.run({
        command: reporter(marker),
        env: { EXTENSION_AGENT_TOKEN: "forged" },
        envFromHost: ["EXTENSION_AGENT_TOKEN"],
      }),
    ).rejects.toThrow("envFromHost");
    expect(existsSync(marker)).toBe(false);
  });

  test("a granted name the host does not have is reported instead of starting the child", async () => {
    const { api } = await setup(["EXTENSION_MISSING_TOKEN"]);
    const marker = join(root, "missing");

    await expect(
      api.run({ command: reporter(marker), envFromHost: ["EXTENSION_MISSING_TOKEN"] }),
    ).rejects.toMatchObject({
      code: "process_environment_unavailable",
    });
    expect(existsSync(marker)).toBe(false);
  });

  test("a host-level process API without a permission owner refuses envFromHost", async () => {
    const marker = join(root, "unowned");

    await expect(
      createProcessApi().run({ command: reporter(marker), envFromHost: ["EXTENSION_AGENT_TOKEN"] }),
    ).rejects.toMatchObject({ code: "process_environment_not_granted" });
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
    "run",
    "spawnDetached",
  ] as const)("%s descendants are stopped before their grant is revoked, even after the launcher exits", async (method) => {
    const { api, permissions } = await setup(["EXTENSION_AGENT_TOKEN"]);
    const marker = join(root, `${method}-background`);
    const launcherMarker = join(root, `${method}-launcher`);
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
      const result = await api[method]({
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
        envFromHost: ["EXTENSION_AGENT_TOKEN"],
      });
      await waitFor(() => existsSync(marker) && readFileSync(marker, "utf8") !== "", "the background PID marker");
      backgroundPid = Number(readFileSync(marker, "utf8"));
      const launcherPid = Number(readFileSync(launcherMarker, "utf8"));
      expect(Number.isSafeInteger(launcherPid) && launcherPid > 0).toBe(true);
      expect(Number.isSafeInteger(backgroundPid) && backgroundPid > 0).toBe(true);
      if ("exitCode" in result) expect(result.exitCode).toBe(0);
      else expect(result.pid).toBe(launcherPid);
      await waitFor(() => !alive(launcherPid), "the launcher to exit");
      expect(alive(backgroundPid)).toBe(true);

      await permissions.revoke("project-1", "acme.agent");
      revoked = true;

      expect(alive(backgroundPid)).toBe(false);
    } finally {
      if (!revoked) await permissions.revoke("project-1", "acme.agent").catch(() => {});
      if (backgroundPid && alive(backgroundPid)) process.kill(backgroundPid, "SIGKILL");
    }
  });
});

test.skipIf(process.platform === "win32")(
  "a program a spawned child leaves running is stopped when the grant is revoked",
  async () => {
    const permissions = createProcessEnvironmentPermissions({
      path: join(root, `${crypto.randomUUID()}.json`),
      findSource: async () => source,
    });
    const { sourceIdentity } = await permissions.read("project-1", "acme.agent");
    await permissions.grant("project-1", "acme.agent", { names: ["EXTENSION_AGENT_TOKEN"], sourceIdentity });
    const owner = createProcessOwner();
    const api = createProcessApi({
      extensionId: "acme.agent",
      hostEnvironment: (names) => permissions.authorize("project-1", source, names),
      callOwner: owner,
    });
    const marker = join(root, "spawn-background");
    const background = `require("node:fs").writeFileSync(${JSON.stringify(marker)}, String(process.pid)); setInterval(() => {}, 1000)`;
    const alive = (pid: number) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    const handle = api.spawn({
      command: [
        process.execPath,
        "-e",
        `require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(background)}], { stdio: "ignore" }).unref()`,
      ],
      envFromHost: ["EXTENSION_AGENT_TOKEN"],
    });
    await handle.exited;
    while (!existsSync(marker) || !readFileSync(marker, "utf8")) await Bun.sleep(10);
    const backgroundPid = Number(readFileSync(marker, "utf8"));
    try {
      expect(alive(backgroundPid)).toBe(true);
      await permissions.revoke("project-1", "acme.agent");
      const deadline = Date.now() + 2_000;
      while (alive(backgroundPid) && Date.now() < deadline) await Bun.sleep(10);
      expect(alive(backgroundPid)).toBe(false);
    } finally {
      if (alive(backgroundPid)) process.kill(backgroundPid, "SIGKILL");
      await owner.close();
    }
  },
);
