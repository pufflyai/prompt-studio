import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
let priorHome: string | undefined;
let priorExtensions: string | undefined;

afterEach(async () => {
  await handle?.close();
  if (priorHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = priorHome;
  if (priorExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = priorExtensions;
  if (root) rmSync(root, { recursive: true, force: true });
});

test("extension commands manage the same saved views as the project API", async () => {
  root = mkdtempSync(join(tmpdir(), "extension-views-"));
  priorHome = process.env.PSTDIO_HOME;
  priorExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
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
const board={kind:"view",id:"tasks"};
const settings={viewMode:"board",columnGrouping:"none",rowGrouping:"none",displayProperties:[]};
const filter={conjunction:"and",rules:[{attributeId:"title",condition:"contains",value:"Ready"}]};
export default {
 views:["tasks","other"].map(id=>({id,ref:{kind:"view",id},title:id,body:{kind:"kanban",query:()=>({rows:[]})}})),
 commands:[{id:"exercise",ref:{kind:"command",id:"exercise"},title:"Exercise",mutating:true,params:{},async run(ctx){
   const initial=await ctx.views.list(board);
   const created=await ctx.views.create(board,{title:"Ready",settings,filter,sorts:[]});
   let invalidCreate=false, invalidUpdate=false;
   try {await ctx.views.create(board,{title:"  "});} catch {invalidCreate=true;}
   try {await ctx.views.update(board,created.id,{title:"  "});} catch {invalidUpdate=true;}
   await ctx.views.update(board,created.id,{title:"  Ready work  "});
   await ctx.views.setDefault(board,created.id);
   await ctx.views.reorder(board,[created.id,...initial.views.map(view=>view.id)]);
   const saved=await ctx.views.list(board);
   const other=await ctx.views.list({kind:"view",id:"other"});
   let outsideBoard;
   try {await ctx.views.update(board,other.views[0].id,{title:"Wrong board"});}
   catch(error){outsideBoard=error.message;}
   await ctx.views.remove(board,created.id);
   let lastView;
   try {await ctx.views.remove(board,initial.views[0].id);}
   catch(error){lastView=error.message;}
   return {saved,remaining:await ctx.views.list(board),other:await ctx.views.list({kind:"view",id:"other"}),outsideBoard,lastView,invalidCreate,invalidUpdate};
 }}]
};`,
  );
  handle = await createTestApp();
  const created = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({ name: "Views" })),
  });
  const projectId = (await created.json()).id;
  const request = (path: string, body?: object) =>
    handle.app.request(`/v1/projects/${projectId}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const enabled = await request("/extensions/installed/views/enable", {
    displayName: "Views",
    extensionId: "test.views",
    manifest: { id: "test.views", name: "views" },
    name: "views",
    sourceHash: null,
    sourceKind: "local_path",
    sourcePath: source,
    sourceRef: null,
    version: null,
  });
  expect(enabled.status).toBe(200);
  const result = await (
    await request("/extensions/commands/test.views.command.exercise/execute", { params: {} })
  ).json();
  expect(result.outcome.status, JSON.stringify(result)).toBe("success");
  const value = result.outcome.value;
  expect(value.invalidCreate).toBe(true);
  expect(value.invalidUpdate).toBe(true);
  expect(value.saved.views.map((view: { title: string }) => view.title)).toEqual(["Ready work", "All"]);
  expect(value.saved.defaultViewId).toBe(value.saved.views[0].id);
  expect(value.saved.views[0].filter.rules).toEqual([{ attributeId: "title", condition: "contains", value: "Ready" }]);
  expect(value.outsideBoard).toBe("View does not belong to this board");
  expect(value.lastView).toContain("at least one");
  expect(value.other.views[0].title).toBe("All");
  const persisted = await (await request("/boards/test.views.view.tasks/views")).json();
  expect(persisted).toEqual(value.remaining);
  expect(persisted.views).toHaveLength(1);
});
