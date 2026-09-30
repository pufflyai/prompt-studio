import { expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeNativeActionsExtension = (root: string) => {
  const source = join(root, "extension-sources", "native-actions");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "native-actions",
      publisher: "test",
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
    {id:"choices",ref:choices,title:"Choices",params:{},run:()=>[{id:"one",name:"One"}]},
    {id:"run",ref:run,title:"Run",params:input,run:(_ctx:unknown,params:unknown)=>params},
  ],
  views:["dataTable","kanban"].map(kind=>({id:kind.toLowerCase(),ref:{kind:"view",id:kind.toLowerCase()},title:kind,body:{kind,query:()=>({rows:[]}),...(kind==="kanban"?{attributes:[
    {id:"site",label:"Site",type:{kind:"string"},display:{kind:"text"},listColumn:{placement:"start",size:"sm"}},
    {id:"url",label:"Open source",type:{kind:"string"},display:{kind:"link"},listColumn:{placement:"end",size:"xs"}}
  ]}:{}),toolbarActions:[{id:"run",label:"Run",command:run,presentation:"primary",input}]}})),
};
`,
  );
  return source;
};

export const expectPackagedNativeActions = async (input: {
  baseUrl: string;
  projectId: string;
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
    expect(view.body.toolbarActions[0]).toMatchObject({
      presentation: "primary",
      command: { id: "run", extensionId: "test.native-actions" },
      input: { value: { options: { command: { id: "choices", extensionId: "test.native-actions" } } } },
    });
    if (kind === "kanban") {
      expect(view.body.attributes).toMatchObject([
        { id: "site", display: { kind: "text" }, listColumn: { placement: "start", size: "sm" } },
        { id: "url", display: { kind: "link" }, listColumn: { placement: "end", size: "xs" } },
      ]);
    }
  }
  const execute = (command: string, params: unknown) =>
    fetch(`${root}/commands/test.native-actions.command.${command}/execute`, {
      method: "POST",
      headers: { ...input.headers, "content-type": "application/json" },
      body: JSON.stringify({ source: "cli", params }),
    });
  expect(await (await execute("choices", {})).json()).toMatchObject({
    outcome: { status: "success", value: [{ id: "one", name: "One" }] },
  });
  expect(await (await execute("run", { value: "explicit" })).json()).toMatchObject({
    outcome: { status: "success", value: { value: "explicit" } },
  });
};
