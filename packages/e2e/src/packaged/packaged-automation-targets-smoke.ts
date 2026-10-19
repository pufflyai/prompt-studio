import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export const registerAutomationTargetSmokeTests = () => {
  test(
    "compiled CLI preserves exact automation targets and pending disable across restart",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "packaged-targets-"));
      const home = join(root, "home");
      const repo = join(root, "repo");
      const source = join(root, "source");
      for (const path of [home, repo, source]) mkdirSync(path);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "clock",
          publisher: "test",
          version: "1.0.0",
          main: "extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(
        join(source, "extension.ts"),
        `export default {
      commands: [{ id: "tick", ref: { kind: "command", id: "tick" }, title: "Tick", async run() {} }],
      schedules: [{ id: "tick", ref: { kind: "schedule", id: "tick" }, title: "Tick", schedule: "0 3 * * *",
        command: { kind: "command", id: "tick" } }],
    };`,
      );
      let host = await startPackagedServe(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
      try {
        const request = (path: string, body?: unknown) =>
          fetch(`${host.baseUrl}/v1${path}`, {
            method: body === undefined ? "GET" : "POST",
            headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
        const response = await request("/projects", folderProjectInput({ name: "Targets" }, repo));
        expect(response.status).toBe(201);
        const { id: projectId } = (await response.json()) as { id: string };
        const workspaces = (await (await request(`/workspaces?projectId=${projectId}`)).json()) as { id: string }[];
        const run = (...args: string[]) =>
          spawnSync(PACKAGED_BINARY_PATH, ["extensions", "automations", ...args, "--project-id", projectId], {
            cwd: repo,
            encoding: "utf8",
            env: {
              ...process.env,
              PSTDIO_HOME: home,
              PSTDIO_API_URL: host.baseUrl,
              PSTDIO_API_TOKEN: host.descriptor.token,
            },
          });
        const enabled = await request(`/projects/${projectId}/extensions/installed/clock/enable`, {
          displayName: "Clock",
          extensionId: "test.clock",
          name: "clock",
          manifest: { name: "clock" },
          sourceKind: "local_path",
          sourcePath: source,
          sourceHash: null,
          sourceRef: null,
          version: null,
        });
        expect(enabled.status).toBe(200);
        const assigned = run("assign", "test.clock.schedule.tick", "--workspace-id", workspaces[0]!.id);
        expect(assigned.status).toBe(0);
        const before = JSON.parse(run("list").stdout);
        expect(before[0]).toMatchObject({
          delivery: "pending",
          target: { workbenchId: projectId, workspaceId: workspaces[0]!.id },
        });
        expect(run("assign", "test.clock.schedule.tick", "--workspace-id", workspaces[0]!.id).status).not.toBe(0);
        const disabled = run("disable", "test.clock.schedule.tick", "--expected-revision", before[0].revision);
        expect(disabled.status).toBe(0);
        await stopProcess(host.child);
        host = await startPackagedServe(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
        const after = JSON.parse(run("list").stdout);
        expect(after[0]).toMatchObject({ enabled: false, delivery: "pending", target: before[0].target });
        expect(JSON.parse(run("runs").stdout)).toEqual([]);
      } finally {
        await stopProcess(host.child);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
};
