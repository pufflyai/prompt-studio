import { expect } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeNativeActionsExtension = (root: string, publisher = "test") => {
  const source = join(root, "extension-sources", "native-actions");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "native-actions",
      publisher,
      version: "1.0.0",
      main: "./extension.ts",
      type: "module",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `
const choices = {kind:"command",id:"choices"};
const run = {kind:"command",id:"run"};
const input = {value:{type:"select",options:{command:choices,valueField:"id",labelField:"name"}}};
export default {
  commands:[
    {id:"store",ref:{kind:"command",id:"store"},title:"Store",params:{},run:async(ctx)=>{await ctx.extensionFiles.writeText("draft.txt",${JSON.stringify(`Stored draft for ${publisher}`)});return await ctx.extensionFiles.readText("draft.txt");}},
    {id:"fail",ref:{kind:"command",id:"fail"},title:"Fail",params:{},run:()=>{throw new Error("Native action failed");}},
    {id:"choices",ref:choices,title:"Choices",params:{},run:()=>[{id:"one",name:"One"}]},
    {id:"run",ref:run,title:"Run",params:input,run:(_ctx:unknown,params:unknown)=>params},
  ],
  workspaceTypes:[{
    id:"machine",ref:{kind:"workspace-type",id:"machine"},label:"Agent machine",params:input,
    create:(_ctx,input)=>({
      state:"ready",executionKind:"remote",providerRef:{version:1,data:{value:input.params.value}},
      capabilities:{files:"none",diff:false,merge:false,rebase:false,archive:false,delete:false},
    }),
    resolve:(_ctx,input)=>({state:"ready",executionKind:"remote",providerRef:input.providerRef,
      capabilities:{files:"none",diff:false,merge:false,rebase:false,archive:false,delete:false}}),
  }],
  views:[...["dataTable","kanban"].map(kind=>({id:kind.toLowerCase(),ref:{kind:"view",id:kind.toLowerCase()},title:kind,body:{kind,...(kind==="dataTable"?{columns:[{id:"approved",type:"boolean"}]}:{schemaRefreshEvents:[],onMove:(_ctx,input)=>input,attributes:[{id:"approved",label:"Approved",type:{kind:"boolean"},filterable:true}]}),query:()=>({rows:[kind==="dataTable"?{id:"one",values:{approved:false}}:{id:"one",title:"One",attributes:{approved:false}}]}),toolbarActions:[{id:"run",label:"Run",command:run,presentation:"primary",input}]}})),
    {id:"agent",ref:{kind:"view",id:"agent"},title:"Research agent",body:{kind:"controls",query:()=>({params:[{id:"agent",name:"Model",type:"harness",defaultValue:{harnessId:"test.native-actions.harness.worker",model:"research",params:{effort:"high"}}}]}),onApply:(_ctx,input)=>input.values}}
  ],
};
`,
  );
  return source;
};

export const expectPackagedNativeActions = async (input: {
  baseUrl: string;
  projectId: string;
  projectFolder: string;
  headers: Record<string, string>;
}) => {
  const root = `${input.baseUrl}/v1/projects/${input.projectId}/extensions`;
  const metadata = await fetch(`${root}/ui`, { headers: input.headers });
  expect(metadata.status).toBe(200);
  const body = await metadata.json();
  for (const kind of ["dataTable", "kanban"]) {
    const view = body.views.find(
      (entry: { extensionId: string; localId: string }) =>
        entry.extensionId === "test.native-actions" && entry.localId === kind.toLowerCase(),
    );
    expect(view, JSON.stringify(body.diagnostics)).toBeDefined();
    if (kind === "kanban") {
      expect(view.body.schemaRefreshEventIds).toEqual([]);
      const move = { rowId: "one", attributes: { approved: true }, order: {} };
      const response = await fetch(`${root}/commands/${view.body.moveHandlerId}/execute`, {
        method: "POST",
        headers: { ...input.headers, "content-type": "application/json" },
        body: JSON.stringify({ params: move }),
      });
      expect(response.status).toBe(200);
      expect((await response.json()).outcome.value).toMatchObject(move);
    }
    const filter = { conjunction: "and", rules: [{ attributeId: "approved", condition: "is", value: false }] };
    const created = await fetch(`${input.baseUrl}/v1/projects/${input.projectId}/boards/${view.id}/views`, {
      method: "POST",
      headers: { ...input.headers, "content-type": "application/json" },
      body: JSON.stringify({ title: "Unapproved", filter }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ filter });
    expect(view.body.toolbarActions[0]).toMatchObject({
      presentation: "primary",
      command: { id: "run", extensionId: "test.native-actions" },
      input: { value: { options: { command: { id: "choices", extensionId: "test.native-actions" } } } },
    });
  }
  const execute = (command: string, params: unknown) =>
    fetch(`${root}/commands/test.native-actions.command.${command}/execute`, {
      method: "POST",
      headers: { ...input.headers, "content-type": "application/json" },
      body: JSON.stringify({ source: "cli", params }),
    });
  expect(await (await execute("store", {})).json()).toMatchObject({
    outcome: { ok: true, value: "Stored draft for test" },
  });
  const otherStore = await fetch(`${root}/commands/other.native-actions.command.store/execute`, {
    method: "POST",
    headers: { ...input.headers, "content-type": "application/json" },
    body: JSON.stringify({ source: "cli", params: {} }),
  });
  expect(await otherStore.json()).toMatchObject({ outcome: { ok: true, value: "Stored draft for other" } });
  expect(
    readFileSync(join(input.projectFolder, ".pstdio/extension-storage/test.native-actions/draft.txt"), "utf8"),
  ).toBe("Stored draft for test");
  expect(
    readFileSync(join(input.projectFolder, ".pstdio/extension-storage/other.native-actions/draft.txt"), "utf8"),
  ).toBe("Stored draft for other");
  const agentView = body.views.find(
    (entry: { extensionId: string; localId: string }) =>
      entry.extensionId === "test.native-actions" && entry.localId === "agent",
  );
  const agent = { harnessId: "test.native-actions.harness.worker", model: "research", params: { effort: "high" } };
  const renderer = { rendererId: agentView.id, projectId: input.projectId };
  const query = await fetch(`${root}/commands/${agentView.body.queryHandlerId}/execute`, {
    method: "POST",
    headers: { ...input.headers, "content-type": "application/json" },
    body: JSON.stringify({ params: { renderer }, source: "cli" }),
  });
  expect(await query.json()).toMatchObject({
    outcome: { ok: true, value: { params: [{ type: "harness", defaultValue: agent }] } },
  });
  const applied = await fetch(`${root}/commands/${agentView.body.applyHandlerId}/execute`, {
    method: "POST",
    headers: { ...input.headers, "content-type": "application/json" },
    body: JSON.stringify({ params: { renderer, values: { agent } }, source: "cli" }),
  });
  expect(await applied.json()).toMatchObject({ outcome: { ok: true, value: { agent } } });
  expect(await (await execute("fail", {})).json()).toMatchObject({
    outcome: { ok: false, status: "error", error: { message: "Native action failed" } },
  });
  expect(await (await execute("choices", {})).json()).toMatchObject({
    outcome: { status: "success", value: [{ id: "one", name: "One" }] },
  });
  expect(await (await execute("run", { value: "explicit" })).json()).toMatchObject({
    outcome: { status: "success", value: { value: "explicit" } },
  });
  const providers = await fetch(`${input.baseUrl}/v1/projects/${input.projectId}/workspace-providers`, {
    headers: input.headers,
  });
  expect(providers.status).toBe(200);
  expect(await providers.json()).toContainEqual(
    expect.objectContaining({
      id: "test.native-actions.workspace-type.machine",
      params: {
        value: expect.objectContaining({
          options: expect.objectContaining({
            command: { kind: "command", id: "choices", extensionId: "test.native-actions" },
          }),
        }),
      },
    }),
  );
  const created = await fetch(`${input.baseUrl}/v1/workspaces`, {
    method: "POST",
    headers: { ...input.headers, "content-type": "application/json" },
    body: JSON.stringify({
      project_id: input.projectId,
      provider_id: "test.native-actions.workspace-type.machine",
      params: { value: "one" },
    }),
  });
  expect(created.status).toBe(202);
  expect(await created.json()).toMatchObject({
    provider_state: "ready",
    provider_params_json: { value: "one" },
    provider_ref_json: { version: 1, data: { value: "one" } },
  });
};
