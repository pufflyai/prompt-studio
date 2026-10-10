import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION, type ExtensionSessionPage } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerSessionQuerySmokeTests = () => {
  test("packaged session queries expose saved usage through extension commands and HTTP", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-session-query-"));
    let child: ChildProcess | undefined;
    try {
      const sourcePath = join(root, "extension");
      mkdirSync(sourcePath);
      writeFileSync(
        join(sourcePath, "package.json"),
        JSON.stringify({
          name: "session-query",
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
        export default {
          harnesses: [{ id: "worker", ref: { kind: "harness", id: "worker" }, label: "Worker", capabilities: () => [],
            start(_ctx, input) {
              input.events.push({ op: "add", path: "/messages/0", value: { id: "usage", role: "system", parts: [
                { type: "token_usage", inputTokens: 12, outputTokens: 4, cacheReadTokens: 3 }
              ] } });
              return { done: Promise.resolve({ status: "completed" }), stop() {} };
            },
            resume() { throw new Error("Not used by this smoke test"); }
          }],
          commands: [{ id: "read", ref: { kind: "command", id: "read" }, title: "Read sessions",
            run(ctx, params) { return ctx.sessions.query({ cursor: params?.cursor, agent: "test.session-query.harness.worker", status: ["completed"] }); }
          }]
        };
      `,
      );
      const runtime = await startPackagedServe(root);
      child = runtime.child;
      const request = async (path: string, body?: unknown) => {
        const response = await fetch(`${runtime.baseUrl}/v1${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const result = await response.json();
        expect(response.status, JSON.stringify(result)).toBeLessThan(300);
        return result;
      };
      const folder = join(root, "project");
      mkdirSync(folder);
      const project = await request("/projects", folderProjectInput({ name: "Session query" }, folder));
      await request(`/projects/${project.id}/extensions/installed/session-query/enable`, {
        displayName: "Session query",
        extensionId: "test.session-query",
        name: "session-query",
        manifest: { name: "session-query" },
        sourceKind: "local_path",
        sourcePath,
        sourceHash: null,
        sourceRef: null,
        version: null,
      });
      const session = await request("/sessions", {
        project_id: project.id,
        title: "Usage",
        prompt: "run",
        agent: "test.session-query.harness.worker",
      });
      const commandPath = `/projects/${project.id}/extensions/commands/test.session-query.command.read/execute`;
      let page: ExtensionSessionPage | undefined;
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await request(commandPath, { source: "api" });
        expect(result.outcome.ok).toBe(true);
        page = result.outcome.value;
        if (page?.items[0]?.usage) break;
        await Bun.sleep(50);
      }
      const usage = { input_tokens: 12, output_tokens: 4, cache_read_tokens: 3, cache_write_tokens: 0 };
      expect(page).toMatchObject({
        items: [{ id: session.id, agent: "test.session-query.harness.worker", usage }],
        nextCursor: null,
      });
      const cursor = Buffer.from(JSON.stringify({ projectId: project.id, createdAt: "", id: "" })).toString(
        "base64url",
      );
      const restarted = await request(commandPath, { source: "api", params: { cursor } });
      expect(restarted.outcome.value).toEqual(page);
      const rows = await request(
        `/sessions?project_id=${project.id}&created_from=${encodeURIComponent(session.created_at)}`,
      );
      expect(rows).toMatchObject([{ id: session.id, usage_json: usage }]);
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
};
