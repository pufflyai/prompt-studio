import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

interface NativeSettingsInput {
  baseUrl: string;
  projectId: string;
  root: string;
  headers: Record<string, string>;
}

export async function verifyPackagedNativeSettings(page: Page, input: NativeSettingsInput) {
  const { baseUrl, projectId, root, headers } = input;
  const source = join(root, "native-settings");
  mkdirSync(source);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "native-settings",
      displayName: "Native settings",
      publisher: "test",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `export default {
    views:[{id:"settings",ref:{kind:"view",id:"settings"},title:"Native settings",body:{kind:"controls",
      async query(ctx){return {groups:[{id:"settings",title:"Native settings",params:[
        {id:"status",type:"selection",name:"Status",defaultValue:"todo",searchable:true,options:[{id:"todo",name:"Todo",icon:"status-todo",color:"purple"},{id:"done",name:"Done",icon:"status-done",color:"green"}]},
        ...Array.from({length:12},(_,index)=>({id:"detail-"+index,type:"text",name:"Detail "+index,defaultValue:"",singleLine:true}))
      ]}],values:await ctx.storage.get("values")??{}}},
      async onApply(ctx,input){if(input.values["detail-0"]==="invalid")throw new Error("Choose valid details");await ctx.storage.set("values",input.values)}
    }},{id:"instant",ref:{kind:"view",id:"instant"},title:"Immediate choices",body:{kind:"controls",
      async query(ctx){return {params:["first","second"].map(id=>({id,type:"text",name:id==="first"?"First choice":"Second choice",defaultValue:"",singleLine:true})),values:await ctx.storage.get("instant-values")??{}}},
      async onValueChange(ctx,input){
        const claims=ctx.storage.collection("write-claims");const claim={id:crypto.randomUUID()};
        if(!await claims.createIfAbsent("instant",claim))throw new Error("A settings write is already running");
        try{while(!await ctx.storage.get("release-write"))await Bun.sleep(20);await ctx.storage.set("instant-values",input.values)}finally{await claims.deleteIfValue("instant",claim)}
      }
    }}],
    commands:[{id:"read-instant-values",ref:{kind:"command",id:"read-instant-values"},title:"Read instant values",async run(ctx){return {values:await ctx.storage.get("instant-values"),busy:!!await ctx.storage.collection("write-claims").get("instant")}}},
      {id:"release-write",ref:{kind:"command",id:"release-write"},title:"Release write",run:ctx=>ctx.storage.set("release-write",true)}],
    settingsPanels:["settings","instant"].map(id=>({id,ref:{kind:"settings-panel",id},view:{kind:"view",id},slot:{extensionId:"pstdio",kind:"settings-panel",id:"extension.settings"}}))
  };`,
  );
  const response = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions/installed/native-settings/enable`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({
      displayName: "Native settings",
      extensionId: "test.native-settings",
      manifest: { id: "test.native-settings", name: "native-settings" },
      name: "native-settings",
      sourceKind: "local_path",
      sourcePath: source,
    }),
  });
  expect(response.status).toBe(200);
  await page.getByRole("option", { name: "Extensions", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/extensions$`));
  await page.reload();
  const entry = page.getByTestId("extension-entry").filter({ hasText: "test.native-settings" });
  await entry.click();
  const detail = page.getByRole("textbox", { name: "Detail 0", exact: true });
  await detail.fill("invalid");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Choose valid details" })).toBeVisible();
  await expect(detail).toHaveValue("invalid");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(detail).toHaveValue("");
  await detail.fill("Native controls persist their values");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(detail).toHaveValue("Native controls persist their values");
  await expect(page.getByRole("button", { name: "Todo", exact: true })).toBeVisible();
  const scrolls = await page
    .getByRole("main")
    .evaluate(
      (page) =>
        Array.from(page.querySelectorAll("*")).filter(
          (element) =>
            element.clientHeight > 0 &&
            element.scrollHeight > element.clientHeight + 2 &&
            /auto|scroll/.test(getComputedStyle(element).overflowY),
        ).length,
    );
  expect(scrolls).toBe(1);
  await page.getByTestId("extension-detail-back").click();
  await entry.click();
  await expect(detail).toHaveValue("Native controls persist their values");
  const first = page.getByRole("textbox", { name: "First choice", exact: true });
  const second = page.getByRole("textbox", { name: "Second choice", exact: true });
  const execute = async (command: string) => {
    const saved = await fetch(
      `${baseUrl}/v1/projects/${projectId}/extensions/commands/test.native-settings.command.${command}/execute`,
      {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ params: {} }),
      },
    );
    const body = (await saved.json()) as { outcome: { value: { values: unknown; busy: boolean } } };
    return body.outcome.value;
  };
  await first.fill("First saved choice");
  await expect.poll(async () => (await execute("read-instant-values")).busy).toBe(true);
  await second.fill("Second saved choice");
  await first.focus();
  await execute("release-write");
  await expect
    .poll(async () => (await execute("read-instant-values")).values)
    .toEqual({ first: "First saved choice", second: "Second saved choice" });
  await page.getByTestId("extension-detail-back").click();
  await entry.click();
  await expect(first).toHaveValue("First saved choice");
  await expect(second).toHaveValue("Second saved choice");
}
