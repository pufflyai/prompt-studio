import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerHarnessCleanupSmokeTests = () => {
  test("packaged host releases project harness resources on disablement and shutdown", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-harness-cleanup-"));
    const evidence = join(root, "released.jsonl");
    let child: ChildProcess | undefined;
    try {
      const sourcePath = join(root, "cleanup-extension");
      mkdirSync(sourcePath);
      writeFileSync(
        join(sourcePath, "package.json"),
        JSON.stringify({
          name: "cleanup-smoke",
          publisher: "test",
          version: "1.0.0",
          type: "module",
          main: "./extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(
        join(sourcePath, "extension.ts"),
        `
        import { appendFileSync } from "node:fs";
        const used = new Set();
        const run = () => ({ done: Promise.resolve({ status: "completed" }), stop() {} });
        export default { harnesses: [{
          id: "worker", ref: { kind: "harness", id: "worker" }, label: "Worker",
          capabilities: () => [], start: run, resume: run,
          getCommandState: () => ({ commands: [{ name: "/goal", description: "Native fixture command" }], modes: [], slashCommands: true }),
          prepareOperation: (_ctx, _input, operation) => ({ execution: "control", invoke: async () => ({ kind: "completed", message: operation.text }) }),
          listModels(ctx) { if (ctx.projectId) used.add(ctx.projectId); return []; },
          dispose(ctx) {
            if (used.delete(ctx.projectId)) appendFileSync(${JSON.stringify(evidence)}, JSON.stringify(ctx.projectId) + "\\n");
          },
        }] };
      `,
      );
      const started = await startPackagedServe(root);
      child = started.child;
      const request = async (path: string, method = "GET", body?: unknown) => {
        const response = await fetch(`${started.baseUrl}/v1${path}`, {
          method,
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`);
        return JSON.parse(text);
      };
      const projects: Array<{ id: string; instanceId: string }> = [];
      for (const name of ["first", "second"]) {
        const folder = join(root, name);
        mkdirSync(folder);
        const project = await request("/projects", "POST", folderProjectInput({ name }, folder));
        const enabled = await request(`/projects/${project.id}/extensions/installed/cleanup-smoke/enable`, "POST", {
          displayName: "Cleanup",
          extensionId: "test.cleanup-smoke",
          name: "cleanup-smoke",
          manifest: { name: "cleanup-smoke" },
          sourceKind: "local_path",
          sourcePath,
          sourceHash: null,
          sourceRef: null,
          version: null,
        });
        projects.push({ id: project.id, instanceId: enabled.instanceId });
        const draftState = await request("/sessions/harness-command-state", "POST", {
          project_id: project.id,
          agent: "test.cleanup-smoke.harness.worker",
        });
        expect(draftState.commands[0].name).toBe("/goal");
        const firstCommand = await request("/sessions", "POST", {
          project_id: project.id,
          title: "First native command",
          agent: draftState.harnessId,
          operation: { kind: "command", text: "/goal first action" },
        });
        expect(firstCommand).toMatchObject({
          agent_session_id: null,
          operation_result: { status: "completed", message: "/goal first action" },
        });
        const session = await request("/sessions", "POST", {
          project_id: project.id,
          title: "Native commands",
          prompt: "Hello",
          agent: "test.cleanup-smoke.harness.worker",
        });
        const state = await request(`/sessions/${session.id}/harness-commands`);
        expect(state.commands[0].name).toBe("/goal");
        const outcome = await request(`/sessions/${session.id}/harness-commands`, "POST", {
          harnessId: state.harnessId,
          operation: { kind: "command", text: "/goal  exact native argument" },
        });
        expect(outcome).toMatchObject({ status: "completed", message: "/goal  exact native argument" });
        await request(`/agents/test.cleanup-smoke.harness.worker/models?project=${project.id}`);
      }
      const releases = () =>
        existsSync(evidence)
          ? readFileSync(evidence, "utf8")
              .trim()
              .split("\n")
              .map((line) => JSON.parse(line))
          : [];
      const first = projects[0];
      await request(`/projects/${first.id}/extensions/${first.instanceId}`, "PATCH", { enabled: false });
      for (let attempt = 0; attempt < 50 && !releases().includes(first.id); attempt++) await Bun.sleep(20);
      expect(releases()).toEqual([first.id]);
      await stopProcess(child);
      child = undefined;
      expect(releases().sort()).toEqual(projects.map((project) => project.id).sort());
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
};
