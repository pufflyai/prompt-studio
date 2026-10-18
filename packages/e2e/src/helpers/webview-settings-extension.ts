import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeWebviewSettingsExtension = (root: string) => {
  const source = join(root, "extensions", "settings-fixture");
  const sdk = join(source, "node_modules", "@pstdio", "sdk");
  mkdirSync(sdk, { recursive: true });
  cpSync(join(import.meta.dirname, "../../../sdk/dist"), join(sdk, "dist"), { recursive: true });
  writeFileSync(
    join(sdk, "package.json"),
    JSON.stringify({ name: "@pstdio/sdk", type: "module", exports: { "./extensions": "./dist/extensions/index.js" } }),
  );
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "settings-fixture",
      publisher: "test",
      version: "1.0.0",
      type: "module",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `
import { defineExtension, defineView, definePage, packageAsset, workbenchModes } from "@pstdio/sdk/extensions";
export const settings = { properties: { density: { type: "string", scope: "project", default: "comfortable" } } } as const;
const view = defineView({ id: "settings", title: "Settings fixture", body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url), capabilities: ["extension.settings.get", "extension.settings.set", "extension.settings.delete"] } });
const page = definePage({ id: "settings", title: "Settings", path: "settings", mode: workbenchModes.project, main: { kind: "view", view: view.ref, cardinality: "one" }, slots: [] });
export default defineExtension({ settings, views: [view], pages: [page] });
`,
  );
  writeFileSync(
    join(source, "view.ts"),
    `
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import type { settings } from "./extension";
export default defineExtensionView({ render({ mount, host }) {
  const client = createWebviewClient<Record<string, never>, typeof settings>(host);
  mount.innerHTML = '<button id="override">Use compact</button><button id="reset">Reset</button><output></output>';
  const show = async () => { mount.querySelector('output').textContent = await client.settings.get("density"); };
  mount.querySelector('#override').onclick = async () => { await client.settings.set("density", "compact"); await show(); };
  mount.querySelector('#reset').onclick = async () => { await client.settings.delete("density"); await show(); };
  void show();
} });
`,
  );
  return source;
};
