import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerExtensionAutomationSmokeTests = () => {
  test("extension commands enqueue durable runs through the packaged host context", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-extension-automation-"));
    let child: ChildProcess | undefined;
    try {
      const sourcePath = join(root, "automation-extension");
      mkdirSync(sourcePath);
      writeFileSync(
        join(sourcePath, "package.json"),
        JSON.stringify({
          name: "automation-smoke",
          publisher: "test",
          version: "1.0.0",
          type: "module",
          main: "./extension.ts",
          engines: { pstdio: EXTENSION_API_VERSION },
        }),
      );
      writeFileSync(
        join(sourcePath, "extension.ts"),
        `
        export default { commands: [
          { id: "start", ref: { kind: "command", id: "start" }, title: "Start", params: {}, async run(ctx) {
            return ctx.automation.enqueue({ command: { kind: "command", id: "worker" }, input: {}, key: "one" });
          } },
          { id: "worker", ref: { kind: "command", id: "worker" }, title: "Worker", automation: true, params: {}, async run(ctx) {
            await ctx.storage.set("completed", true);
            return { source: ctx.source, completed: true };
          } },
          { id: "list", ref: { kind: "command", id: "list" }, title: "List", params: {}, async run(ctx) { return ctx.automation.list(); } },
        ] };
      `,
      );
      let started = await startPackagedServe(root);
      child = started.child;
      const request = (path: string, body?: unknown) =>
        fetch(`${started.baseUrl}${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      const projectResponse = await request("/v1/projects", { name: "automation" });
      expect(projectResponse.status).toBe(201);
      const project = (await projectResponse.json()) as { id: string };
      const enabled = await request(`/v1/projects/${project.id}/extensions/installed/automation-smoke/enable`, {
        displayName: "Automation",
        extensionId: "test.automation-smoke",
        name: "automation-smoke",
        manifest: { name: "automation-smoke" },
        sourceKind: "local_path",
        sourcePath,
        sourceHash: null,
        sourceRef: null,
        version: null,
      });
      expect(enabled.status).toBe(200);
      const execute = async (command: string) => {
        const response = await request(
          `/v1/projects/${project.id}/extensions/commands/test.automation-smoke.command.${command}/execute`,
          { source: "api", params: {} },
        );
        expect(response.status).toBe(200);
        return (await response.json()) as { outcome: { ok: boolean; value: unknown } };
      };
      const first = await execute("start");
      expect(first.outcome.ok).toBe(true);
      const id = (first.outcome.value as { id: string }).id;
      const retry = await execute("start");
      expect(retry.outcome.value).toMatchObject({ id });
      let runs: unknown[] = [];
      for (let attempt = 0; attempt < 50; attempt += 1) {
        runs = (await execute("list")).outcome.value as unknown[];
        if ((runs[0] as { status: string })?.status === "succeeded") break;
        await Bun.sleep(10);
      }
      expect(runs).toEqual([
        expect.objectContaining({ id, status: "succeeded", result: { source: "automation", completed: true } }),
      ]);
      await stopProcess(child);
      child = undefined;
      started = await startPackagedServe(root);
      child = started.child;
      expect((await execute("list")).outcome.value).toEqual(runs);
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
};
