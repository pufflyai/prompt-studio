import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  test.skipIf(process.platform === "win32")(
    "a program a detached child leaves running is stopped when the grant is revoked",
    async () => {
      const { api, permissions } = await setup(["EXTENSION_AGENT_TOKEN"]);
      const marker = join(root, "detached-background");
      const background = `require("node:fs").writeFileSync(${JSON.stringify(marker)}, String(process.pid)); setInterval(() => {}, 1000)`;
      const alive = (pid: number) => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      };

      const { pid } = await api.spawnDetached({
        command: [
          process.execPath,
          "-e",
          `require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(background)}], { stdio: "ignore" }).unref()`,
        ],
        envFromHost: ["EXTENSION_AGENT_TOKEN"],
      });
      while (!existsSync(marker) || !readFileSync(marker, "utf8")) await Bun.sleep(10);
      const backgroundPid = Number(readFileSync(marker, "utf8"));
      try {
        while (alive(pid!)) await Bun.sleep(10);
        expect(alive(backgroundPid)).toBe(true);

        await permissions.revoke("project-1", "acme.agent");

        const deadline = Date.now() + 2_000;
        while (alive(backgroundPid) && Date.now() < deadline) await Bun.sleep(10);
        expect(alive(backgroundPid)).toBe(false);
      } finally {
        if (alive(backgroundPid)) process.kill(backgroundPid, "SIGKILL");
      }
    },
  );

  test.skipIf(process.platform === "win32")(
    "a program a run command leaves running is stopped when the grant is revoked",
    async () => {
      const { api, permissions } = await setup(["EXTENSION_AGENT_TOKEN"]);
      const marker = join(root, "run-background");
      const background = `require("node:fs").writeFileSync(${JSON.stringify(marker)}, String(process.pid)); setInterval(() => {}, 1000)`;
      const alive = (pid: number) => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      };

      // run returns once its own child exits; the program it started keeps the granted value.
      await api.run({
        command: [
          process.execPath,
          "-e",
          `require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(background)}], { stdio: "ignore" }).unref()`,
        ],
        envFromHost: ["EXTENSION_AGENT_TOKEN"],
      });
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
      }
    },
  );
});
