import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

interface SettingsSizingInput {
  baseUrl: string;
  projectId: string;
  root: string;
  headers: Record<string, string>;
}

export async function verifyPackagedSettingsSizing(page: Page, input: SettingsSizingInput) {
  const { baseUrl, projectId, root, headers } = input;
  const source = join(root, "settings-sizing");
  mkdirSync(source);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "settings-sizing",
      displayName: "Sizing probe",
      publisher: "test",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `export default {
    views:[{id:"sizing",ref:{kind:"view",id:"sizing"},title:"Sizing probe",
      body:{kind:"webview",entry:{kind:"package-asset",path:"./sizing-view.ts",baseUrl:import.meta.url}}}],
    settingsPanels:[{id:"sizing",ref:{kind:"settings-panel",id:"sizing"},view:{kind:"view",id:"sizing"},
      slot:{extensionId:"pstdio",kind:"settings-panel",id:"extension.settings"}}]
  };`,
  );
  writeFileSync(
    join(source, "sizing-view.ts"),
    `export default { mount(mount) {
    const content = document.createElement("div");
    content.style.height = "480px";
    content.style.marginBlock = "24px";
    const button = document.createElement("button");
    button.textContent = "Resize content";
    button.onclick = () => { content.style.height = "120px"; };
    content.append(button);
    mount.append(content);
    return () => content.remove();
  }};`,
  );
  const response = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions/installed/settings-sizing/enable`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({
      displayName: "Sizing probe",
      extensionId: "test.settings-sizing",
      manifest: { id: "test.settings-sizing", name: "settings-sizing" },
      name: "settings-sizing",
      sourceHash: null,
      sourceKind: "local_path",
      sourcePath: source,
      sourceRef: null,
      version: null,
    }),
  });
  expect(response.status).toBe(200);
  await page.getByRole("dialog").getByRole("option", { name: "Extensions", exact: true }).click();
  await page.getByTestId("extension-entry").filter({ hasText: "test.settings-sizing" }).click();
  const iframe = page.locator('iframe[title="Sizing probe"]');
  const frame = page.frameLocator('iframe[title="Sizing probe"]');
  await expect(frame.getByRole("button", { name: "Resize content" })).toBeVisible();
  await expect.poll(() => iframe.evaluate((element) => element.clientHeight)).toBe(528);
  await frame.getByRole("button", { name: "Resize content" }).click();
  await expect.poll(() => iframe.evaluate((element) => element.clientHeight)).toBe(168);
  expect(await frame.locator("body").evaluate((body) => body.scrollHeight)).toBe(168);
}
