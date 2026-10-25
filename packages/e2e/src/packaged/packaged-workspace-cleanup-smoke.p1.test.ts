import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

const source = `
let active = 0, peak = 0, deleted = 0, released = false;
const waiters = [];
const ready = (providerRef) => ({
  state: "ready", executionKind: "remote", providerRef,
  capabilities: { files: "none", diff: false, merge: false, rebase: false, delete: true },
});
export default {
  workspaceTypes: [{ id: "remote", ref: { kind: "workspace-type", id: "remote" }, label: "Cleanup fixture",
    create: (_ctx, input) => ready({ version: 1, data: { workspaceId: input.workspaceId } }),
    resolve: (_ctx, input) => ready(input.providerRef),
    async delete() {
      active++; peak = Math.max(peak, active);
      if (!released) await new Promise((resolve) => waiters.push(resolve));
      active--; deleted++;
    },
  }],
  commands: [
    { id: "stats", ref: { kind: "command", id: "stats" }, title: "Read cleanup state",
      run() { return { active, peak, deleted }; } },
    { id: "release", ref: { kind: "command", id: "release" }, title: "Release cleanup",
      run() { released = true; for (const resolve of waiters.splice(0)) resolve(); return {}; } },
  ],
};
`;

setupPackagedSmokeTests();

test(
  "packaged host limits concurrent workspace deletions and drains the queue",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-workspace-cleanup-"));
    let child: ChildProcess | undefined;
    try {
      const sourcePath = join(root, "extension");
      const folder = join(root, "project");
      mkdirSync(sourcePath);
      mkdirSync(folder);
      writeFileSync(join(sourcePath, "extension.ts"), source);
      writeFileSync(
        join(sourcePath, "package.json"),
        JSON.stringify({
          name: "cleanup",
          publisher: "test",
          version: "1.0.0",
          main: "./extension.ts",
          type: "module",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
      child = runtime.child;
      const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
      const request = async (path: string, body?: unknown, method = body === undefined ? "GET" : "POST") => {
        const response = await fetch(`${runtime.baseUrl}/v1${path}`, {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const value = await response.json();
        expect(response.status, JSON.stringify(value)).toBeLessThan(300);
        return value;
      };
      const project = await request("/projects", folderProjectInput({ name: "Cleanup" }, folder));
      await request(`/projects/${project.id}/extensions/installed/cleanup/enable`, {
        displayName: "Cleanup",
        extensionId: "test.cleanup",
        name: "cleanup",
        manifest: { name: "cleanup" },
        sourceKind: "local_path",
        sourcePath,
        sourceHash: null,
        sourceRef: null,
        version: null,
      });
      const command = async (name: string) => {
        const result = await request(
          `/projects/${project.id}/extensions/commands/test.cleanup.command.${name}/execute`,
          { source: "api" },
        );
        expect(result.outcome.ok).toBe(true);
        return result.outcome.value;
      };
      const workspaces: { id: string }[] = [];
      for (let index = 0; index < 6; index++) {
        const workspace = await request("/workspaces", {
          project_id: project.id,
          provider_id: "test.cleanup.workspace-type.remote",
          params: {},
        });
        let state = workspace;
        for (let attempt = 0; state.provider_state !== "ready" && attempt < 100; attempt++) {
          await Bun.sleep(20);
          state = await request(`/workspaces/${workspace.id}`);
        }
        expect(state.provider_state).toBe("ready");
        workspaces.push(workspace);
      }
      const pending = Promise.all(
        workspaces.map((workspace) => request(`/workspaces/${workspace.id}`, undefined, "DELETE")),
      );
      try {
        let stats = await command("stats");
        for (let attempt = 0; stats.active < 2 && attempt < 100; attempt++) {
          await Bun.sleep(20);
          stats = await command("stats");
        }
        expect(stats).toEqual({ active: 2, peak: 2, deleted: 0 });
      } finally {
        await command("release");
        await pending;
      }
      expect(await command("stats")).toEqual({ active: 0, peak: 2, deleted: 6 });
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
