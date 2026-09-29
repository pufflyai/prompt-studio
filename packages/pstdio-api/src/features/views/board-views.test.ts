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
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `
let values=[{value:"todo",label:"To do"},{value:"gone",label:"Gone"}], fail=false;
const settings={viewMode:"board",columnGrouping:"state",rowGrouping:"none",ordering:{attributeId:"manual",direction:"asc"},displayProperties:["state"]};
export default {
commands:[{id:"remove",ref:{kind:"command",id:"remove"},title:"Remove",params:{},run:()=>{values=values.slice(0,1);return null;}},{id:"fail",ref:{kind:"command",id:"fail"},title:"Fail",params:{},run:()=>{fail=true;return null;}}],
views:[{id:"other",ref:{kind:"view",id:"other"},title:"Other",body:{kind:"kanban",query:()=>{throw Error("Other unavailable")}}},{id:"tasks",ref:{kind:"view",id:"tasks"},title:"Tasks",body:{kind:"kanban",defaultSettings:settings,defaultViews:[{id:"all",title:"All",settings,filters:{}}],query:()=>{if(fail)throw Error("Unavailable");return {rows:[],attributes:[{id:"state",label:"State",type:{kind:"enum",options:values},filterable:true,groupable:true,displayable:true,sortable:true}]};}}}]
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

test("exposes runtime fields, protects built-ins, and shares create/default/order/delete", async () => {
  const boards = await request(`/boards/${boardId}`);
  expect(boards.status).toBe(200);
  expect(await boards.json()).toMatchObject({
    id: boardId,
    fields: [{ id: "state", options: [{ value: "todo" }, { value: "gone" }] }],
  });
  expect((await request("/boards")).status).toBe(503);
  const builtIn = await request("/board-views/all", "PATCH", { title: "No" });
  expect(builtIn.status).toBe(409);
  const invalid = await request(`/boards/${boardId}/views`, "POST", { title: "Invalid", filters: { state: ["bad"] } });
  expect(invalid.status).toBe(400);
  expect(await invalid.text()).toContain("todo");
  const response = await request(`/boards/${boardId}/views`, "POST", {
    title: "Todo",
    copyFrom: "all",
    filters: { state: ["todo"] },
  });
  expect(response.status).toBe(201);
  const view = await response.json();
  expect(
    (await (await request(`/boards/${boardId}/views/default`, "PUT", { viewId: view.id })).json()).defaultViewId,
  ).toBe(view.id);
  expect((await request(`/boards/${boardId}/views/order`, "PUT", { viewIds: [] })).status).toBe(400);
  expect((await request(`/board-views/${view.id}`, "DELETE")).status).toBe(200);
  expect((await (await request(`/boards/${boardId}/views`)).json()).defaultViewId).toBe("all");
});

test("cleans deleted runtime options but retains filters when query fails", async () => {
  const create = async () =>
    await (await request(`/boards/${boardId}/views`, "POST", { title: "Gone", filters: { state: ["gone"] } })).json();
  const first = await create();
  await command("fail");
  const failed = await (await request(`/boards/${boardId}/views`)).json();
  expect(failed.views.find((view: { id: string }) => view.id === first.id).filters).toEqual({ state: ["gone"] });
});

test("read-time cleanup persists removed options", async () => {
  const created = await (
    await request(`/boards/${boardId}/views`, "POST", { title: "Gone", filters: { state: ["todo", "gone"] } })
  ).json();
  await command("remove");
  const result = await (await request(`/boards/${boardId}/views`)).json();
  expect(result.views.find((view: { id: string }) => view.id === created.id).filters).toEqual({ state: ["todo"] });
});

test("returns not found for a missing project", async () => {
  expect((await handle.app.request("/v1/projects/missing/boards")).status).toBe(404);
});

test("single reads clean stale options before a title edit", async () => {
  const created = await (
    await request(`/boards/${boardId}/views`, "POST", { title: "Gone", filters: { state: ["todo", "gone"] } })
  ).json();
  await command("remove");
  const current = await (await request(`/board-views/${created.id}`)).json();
  expect(current.filters).toEqual({ state: ["todo"] });
  expect((await request(`/board-views/${created.id}`, "PATCH", { title: "Renamed" })).status).toBe(200);
});
