import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
let projectId: string;
let priorHome: string | undefined;
let priorExtensions: string | undefined;
const boardId = "test.boards.view.tasks";
const request = (path: string, method = "GET", body?: unknown) =>
  handle.app.request(`/v1/projects/${projectId}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const settings = { viewMode: "board", columnGrouping: "state", rowGrouping: "none", displayProperties: ["state"] };
const stateIs = (...value: string[]) => ({
  conjunction: "and",
  rules: [{ attributeId: "state", condition: "is-any-of", value }],
});
const command = (name: string) =>
  request(`/extensions/commands/test.boards.command.${name}/execute`, "POST", { params: {} });

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "board-views-api-"));
  priorHome = process.env.PSTDIO_HOME;
  priorExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const source = join(root, "boards");
  mkdirSync(source);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "boards",
      publisher: "test",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `
let values=[{value:"todo",label:"To do"},{value:"gone",label:"Gone"}], fail=false, inbox=[{id:"a",values:{title:"Mail",score:5}}];
const legacySettings={viewMode:"board",columnGrouping:"state",rowGrouping:"none",ordering:{attributeId:"manual",direction:"asc"},displayProperties:["state"]};
const settings={viewMode:"board",columnGrouping:"state",rowGrouping:"none",displayProperties:["state"]};
const filter={conjunction:"and",rules:[]};
export default {
commands:[{id:"remove",ref:{kind:"command",id:"remove"},title:"Remove",params:{},run:()=>{values=values.slice(0,1);return null;}},{id:"fail",ref:{kind:"command",id:"fail"},title:"Fail",params:{},run:()=>{fail=true;return null;}},{id:"empty",ref:{kind:"command",id:"empty"},title:"Empty",params:{},run:()=>{inbox=[];return null;}}],
views:[...["legacy","explicit"].map(id=>({id,ref:{kind:"view",id},title:id,body:{kind:"kanban",defaultActiveViewId:id==="explicit"?"first":undefined,defaultViews:[{id:"first",title:"First",settings:legacySettings,filters:{}},{id:"flagged",title:"Flagged",settings:legacySettings,filters:{},isDefault:true}],query:()=>({rows:[]})}})),{id:"other",ref:{kind:"view",id:"other"},title:"Other",body:{kind:"kanban",query:()=>{throw Error("Other unavailable")}}},{id:"tasks",ref:{kind:"view",id:"tasks"},title:"Tasks",body:{kind:"kanban",defaultSettings:settings,defaultViews:[{id:"all",title:"All",settings,filter,sorts:[]}],query:()=>{if(fail)throw Error("Unavailable");return {rows:[],attributes:[{id:"state",label:"State",type:{kind:"enum",options:values},filterable:true,groupable:true,displayable:true,sortable:true}]};}}},{id:"scores",ref:{kind:"view",id:"scores"},title:"Scores",body:{kind:"dataTable",columns:[{id:"name",label:"Name"},{id:"status",label:"Status",groupable:true},{id:"score",label:"Score"}],defaultSorts:[{attributeId:"score",direction:"desc"}],query:()=>({rows:[{id:"a",values:{name:"Chat",status:"open",score:80}},{id:"b",values:{name:"Docs",status:null,score:40}}]})}},{id:"inbox",ref:{kind:"view",id:"inbox"},title:"Inbox",body:{kind:"dataTable",query:()=>({rows:inbox})}}]
};`,
  );
  handle = await createTestApp();
  const created = await handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({ name: "Boards" })),
  });
  projectId = (await created.json()).id;
  const enabled = await request("/extensions/installed/boards/enable", "POST", {
    displayName: "Boards",
    extensionId: "test.boards",
    manifest: { id: "test.boards", name: "boards" },
    name: "boards",
    sourceHash: null,
    sourceKind: "local_path",
    sourcePath: source,
    sourceRef: null,
    version: null,
  });
  expect(enabled.status).toBe(200);
});
afterEach(async () => {
  await handle?.close();
  if (priorHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = priorHome;
  if (priorExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = priorExtensions;
  rmSync(root, { recursive: true, force: true });
});

test("uses deprecated default flags only below explicit and project defaults", async () => {
  const path = "/boards/test.boards.view.legacy/views";
  expect(await (await request(path)).json()).toMatchObject({ defaultViewId: "flagged" });
  expect(await (await request("/boards/test.boards.view.explicit/views")).json()).toMatchObject({
    defaultViewId: "first",
  });
  expect((await request(`${path}/default`, "PUT", { viewId: "first" })).status).toBe(200);
  expect(await (await request(path)).json()).toMatchObject({ defaultViewId: "first" });
});

test("exposes runtime fields, protects built-ins, and shares create/default/order/delete", async () => {
  const boards = await request(`/boards/${boardId}`);
  expect(boards.status).toBe(200);
  expect(await boards.json()).toMatchObject({
    id: boardId,
    kind: "kanban",
    fields: [
      { id: "title", kind: "string" },
      { id: "state", options: [{ value: "todo" }, { value: "gone" }] },
    ],
  });
  expect((await request("/boards")).status).toBe(503);
  const builtIn = await request("/board-views/all", "PATCH", { title: "No" });
  expect(builtIn.status).toBe(409);
  const invalid = await request(`/boards/${boardId}/views`, "POST", { title: "Invalid", filter: stateIs("bad") });
  expect(invalid.status).toBe(400);
  expect(await invalid.text()).toContain("todo");
  const response = await request(`/boards/${boardId}/views`, "POST", {
    title: "Todo",
    copyFrom: "all",
    filter: stateIs("todo"),
    sorts: [{ attributeId: "title", direction: "asc" }],
  });
  expect(response.status).toBe(201);
  const view = await response.json();
  expect(view).toMatchObject({
    settings,
    filter: stateIs("todo"),
    sorts: [{ attributeId: "title", direction: "asc" }],
  });
  expect(
    (await (await request(`/boards/${boardId}/views/default`, "PUT", { viewId: view.id })).json()).defaultViewId,
  ).toBe(view.id);
  expect((await request(`/boards/${boardId}/views/order`, "PUT", { viewIds: [] })).status).toBe(400);
  expect((await request(`/board-views/${view.id}`, "DELETE")).status).toBe(200);
  expect((await (await request(`/boards/${boardId}/views`)).json()).defaultViewId).toBe("all");
});

test("retains saved rules when the board query fails", async () => {
  const first = await (
    await request(`/boards/${boardId}/views`, "POST", { title: "Gone", filter: stateIs("gone") })
  ).json();
  await command("fail");
  const failed = await (await request(`/boards/${boardId}/views`)).json();
  expect(failed.views.find((view: { id: string }) => view.id === first.id).filter).toEqual(stateIs("gone"));
});

test("read-time cleanup persists removed options", async () => {
  const created = await (
    await request(`/boards/${boardId}/views`, "POST", { title: "Gone", filter: stateIs("todo", "gone") })
  ).json();
  await command("remove");
  const result = await (await request(`/boards/${boardId}/views`)).json();
  expect(result.views.find((view: { id: string }) => view.id === created.id).filter).toEqual(stateIs("todo"));
});

test("returns not found for a missing project", async () => {
  expect((await handle.app.request("/v1/projects/missing/boards")).status).toBe(404);
});

test("single reads clean stale options before a title edit", async () => {
  const created = await (
    await request(`/boards/${boardId}/views`, "POST", { title: "Gone", filter: stateIs("todo", "gone") })
  ).json();
  await command("remove");
  const current = await (await request(`/board-views/${created.id}`)).json();
  expect(current.filter).toEqual(stateIs("todo"));
  expect((await request(`/board-views/${created.id}`, "PATCH", { title: "Renamed" })).status).toBe(200);
});

test("data table views resolve fields from columns and save shared views", async () => {
  const tableId = "test.boards.view.scores";
  expect(await (await request(`/boards/${tableId}`)).json()).toMatchObject({
    kind: "dataTable",
    fields: [
      { id: "name", kind: "string", groupable: false },
      { id: "status", kind: "string", groupable: true },
      {
        id: "score",
        kind: "number",
        conditions: ["is", "is-not", "gt", "gte", "lt", "lte", "is-empty", "is-not-empty"],
      },
    ],
  });
  const builtIns = await (await request(`/boards/${tableId}/views`)).json();
  expect(builtIns.views).toMatchObject([
    { id: "default", builtIn: true, settings: { grouping: "none" }, sorts: [{ attributeId: "score" }] },
  ]);
  const score = (condition: string, value: unknown) => ({
    conjunction: "and",
    rules: [{ attributeId: "score", condition, value }],
  });
  const refused = await request(`/boards/${tableId}/views`, "POST", { title: "Bad", filter: score("contains", "7") });
  expect(refused.status).toBe(400);
  expect(await refused.text()).toContain("is, is-not, gt, gte, lt, lte, is-empty, is-not-empty");
  const created = await request(`/boards/${tableId}/views`, "POST", {
    title: "High score",
    filter: score("gte", 70),
    settings: { grouping: "status", rowNumbers: false },
  });
  expect(created.status).toBe(201);
  const view = await created.json();
  expect(view).toMatchObject({
    settings: { grouping: "status", rowNumbers: false, wrapRows: false },
    filter: score("gte", 70),
    sorts: [{ attributeId: "score", direction: "desc" }],
  });
  const listed = await (await request(`/boards/${tableId}/views`)).json();
  expect(listed.views.map((saved: { id: string }) => saved.id)).toEqual(["default", view.id]);
  const wrongKind = await request(`/board-views/${view.id}`, "PATCH", { settings: { viewMode: "list" } });
  expect(wrongKind.status).toBe(400);
  expect(await wrongKind.text()).toContain("do not fit a data table view");
});

test("a table that cannot describe its columns keeps its saved views", async () => {
  const tableId = "test.boards.view.inbox";
  const filter = { conjunction: "and", rules: [{ attributeId: "score", condition: "gte", value: 1 }] };
  const created = await request(`/boards/${tableId}/views`, "POST", { title: "Scored", filter });
  expect(created.status).toBe(201);
  const view = await created.json();
  await command("empty");
  const listed = await (await request(`/boards/${tableId}/views`)).json();
  expect(listed.views.find((saved: { id: string }) => saved.id === view.id)).toMatchObject({ filter });
});
