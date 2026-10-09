import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerExtensionViewsSmokeTests = () => {
  test("packaged extension commands share project saved views", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-extension-views-"));
    let child: ChildProcess | undefined;
    try {
      const source = join(root, "views");
      mkdirSync(source);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "views",
          publisher: "test",
          version: "1.0.0",
          main: "./extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(
        join(source, "extension.ts"),
        `
export default {
 views:[{id:"tasks",ref:{kind:"view",id:"tasks"},title:"Tasks",body:{kind:"kanban",query:()=>({rows:[]})}}],
 commands:[{id:"save",ref:{kind:"command",id:"save"},title:"Save",mutating:true,params:{},async run(ctx){
   const board={kind:"view",id:"tasks"};
   const created=await ctx.views.create(board,{title:"Team work",filter:{conjunction:"and",rules:[{attributeId:"title",condition:"contains",value:"Ready"}]}});
   await ctx.views.setDefault(board,created.id);
   return ctx.views.list(board);
 }}]
};`,
      );
      const runtime = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
      child = runtime.child;
      const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
      const response = await fetch(`${runtime.baseUrl}/v1/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name: "Views" }, root)),
      });
      expect(response.status).toBe(201);
      const project = (await response.json()) as { id: string };
      const base = `${runtime.baseUrl}/v1/projects/${project.id}`;
      const enabled = await fetch(`${base}/extensions/installed/views/enable`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          displayName: "Views",
          extensionId: "test.views",
          manifest: { id: "test.views", name: "views" },
          name: "views",
          sourceHash: null,
          sourceKind: "local_path",
          sourcePath: source,
          sourceRef: null,
          version: null,
        }),
      });
      expect(enabled.status).toBe(200);
      const executed = await fetch(`${base}/extensions/commands/test.views.command.save/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify({ params: {} }),
      });
      const result = await executed.json();
      expect(result.outcome.status, JSON.stringify(result)).toBe("success");
      const persisted = await (await fetch(`${base}/boards/test.views.view.tasks/views`, { headers })).json();
      expect(persisted).toEqual(result.outcome.value);
      expect(persisted.views.find((view: { id: string }) => view.id === persisted.defaultViewId)).toMatchObject({
        title: "Team work",
        filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Ready" }] },
      });
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  });
};
