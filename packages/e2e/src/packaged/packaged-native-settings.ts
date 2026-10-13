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
    }}],
    settingsPanels:[{id:"settings",ref:{kind:"settings-panel",id:"settings"},view:{kind:"view",id:"settings"},slot:{extensionId:"pstdio",kind:"settings-panel",id:"extension.settings"}}]
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
  await page.getByRole("dialog").getByRole("option", { name: "Extensions", exact: true }).click();
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
    .locator('[aria-modal="true"][data-scope="dialog"]')
    .evaluate(
      (dialog) =>
        Array.from(dialog.querySelectorAll("*")).filter(
          (element) =>
            element.clientHeight > 0 &&
            element.scrollHeight > element.clientHeight + 2 &&
            /auto|scroll/.test(getComputedStyle(element).overflowY),
        ).length,
    );
  expect(scrolls).toBe(1);
  await page.getByRole("button", { name: "Extensions", exact: true }).click();
  await entry.click();
  await expect(detail).toHaveValue("Native controls persist their values");
}
