import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION, type ExtensionSessionPage } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { assertPackagedSessionRetention } from "./packaged-session-retention-smoke";

export const registerSessionQuerySmokeTests = () => {
  test("packaged session APIs expose usage, execution exits, and guarded follow-ups", async () => {
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
            run(ctx, params) { return ctx.sessions.query({ cursor: params?.cursor, orderBy: params?.orderBy, anchor: params?.anchor, agent: "test.session-query.harness.worker", status: ["completed"] }); }
          }, {id:"inspect",ref:{kind:"command",id:"inspect"},title:"Inspect execution",run(ctx,params){return ctx.sessions.get(params.sessionId);}},
          {id:"workspace",ref:{kind:"command",id:"workspace"},title:"Read workspace",run(ctx){return ctx.workspaces.getDefault();}},
          {id:"continue",ref:{kind:"command",id:"continue"},title:"Guarded continuation",async run(ctx,params){try{await ctx.sessions.followup({sessionId:params.sessionId,prompt:"Automatic continuation",expectedRun:params.expectedRun});return {accepted:true};}catch(error){return {accepted:false,error:error.message};}}}]
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
      const anchor = { type: "project", id: project.id, extensionId: "pstdio", projectId: project.id };
      const session = await request("/sessions", {
        anchors: [anchor],
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
      const client = createClient({ baseUrl: runtime.baseUrl, token: runtime.descriptor.token });
      await assertPackagedSessionRetention(runtime.baseUrl, runtime.descriptor, session.id);
      const filter = {
        agent: "test.session-query.harness.worker",
        status: ["completed"] as const,
        anchor,
        orderBy: "lastActivity" as const,
      };
      const paged = await client.sessions.query(project.id, { ...filter, status: [...filter.status] });
      expect(paged).toEqual(page);
      expect(
        await client.sessions.query(project.id, {
          ...filter,
          status: [...filter.status],
          anchor: { ...anchor, extensionId: "other" },
        }),
      ).toEqual({ items: [], nextCursor: null });
      const iterated = [];
      for await (const item of client.sessions.iterate(project.id, { ...filter, status: [...filter.status] })) {
        iterated.push(item);
      }
      expect(iterated).toEqual(page?.items);
      expect(await client.sessions.query(project.id, { status: [] })).toEqual({ items: [], nextCursor: null });
      const cursor = Buffer.from(JSON.stringify({ projectId: project.id, createdAt: "", id: "" })).toString(
        "base64url",
      );
      const restarted = await request(commandPath, { source: "api", params: { cursor } });
      expect(restarted.outcome.value).toEqual(page);
      const active = await request(commandPath, { source: "api", params: { orderBy: "lastActivity", anchor } });
      expect(active.outcome.value).toEqual(page);
      const rows = await request(
        `/sessions?project_id=${project.id}&created_from=${encodeURIComponent(session.created_at)}`,
      );
      expect(rows).toMatchObject([{ id: session.id, usage_json: usage }]);
      const execute = async (id: string, params: unknown) =>
        (
          await request(`/projects/${project.id}/extensions/commands/test.session-query.command.${id}/execute`, {
            source: "api",
            params,
          })
        ).outcome.value;
      const observed = await execute("inspect", { sessionId: session.id });
      expect(observed).toMatchObject({
        workspaceId: observed.workspace_id,
        createdAt: observed.created_at,
        lastSelectedModel: observed.last_selected_model,
        lastRequestStarted: observed.last_request_started,
        usage: { inputTokens: 12, outputTokens: 4, cacheReadTokens: 3, cacheWriteTokens: 0 },
      });
      expect(observed.lastExit).toEqual(observed.last_exit);
      expect(await client.sessions.get(session.id)).toMatchObject(observed);
      const workspace = await execute("workspace", {});
      expect(workspace).toMatchObject({
        projectId: project.id,
        providerId: "pstdio.root",
        rootPath: workspace.root_path,
      });
      for (const field of ["provider_ref_json", "provider_error_json", "deleted_at"])
        expect(workspace).not.toHaveProperty(field);
      expect(await client.workspaces.getByShorthand(project.id, workspace.shorthand)).toMatchObject(workspace);
      expect(observed.last_exit).toMatchObject({
        cause: "completed",
        startedAt: observed.last_request_started,
        endedAt: observed.last_request_ended,
      });
      const stopped = await fetch(`${runtime.baseUrl}/v1/sessions/${session.id}/status`, {
        method: "PATCH",
        headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      expect(stopped.status).toBe(200);
      const continuation = await execute("continue", {
        sessionId: session.id,
        expectedRun: {
          status: observed.status,
          startedAt: observed.last_request_started,
          endedAt: observed.last_request_ended,
        },
      });
      expect(continuation).toMatchObject({ accepted: false });
      expect(continuation.error).toContain("execution changed");
      expect(await execute("inspect", { sessionId: session.id })).toMatchObject({
        status: "cancelled",
        last_exit: { cause: "user_stop" },
      });
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
};
