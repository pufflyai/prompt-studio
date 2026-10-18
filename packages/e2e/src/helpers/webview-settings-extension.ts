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
const view = defineView({ id: "settings", title: "Settings fixture", body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url), capabilities: ["extension.settings.all", "extension.settings.get", "extension.settings.set", "extension.settings.delete", "page.params.update"] } });
const page = definePage({ id: "settings", title: "Settings", path: "settings", params: { tab: { type: "string", default: "overview" } }, mode: workbenchModes.project, main: { kind: "view", view: view.ref, cardinality: "one" }, slots: [] });
export default defineExtension({ settings, views: [view], pages: [page] });
`,
  );
  writeFileSync(
    join(source, "view.ts"),
    `
import { createWebviewClient, defineExtensionView, isWebviewCapabilityError } from "@pstdio/sdk/extensions";
import type { settings } from "./extension";
export default defineExtensionView({ render({ mount, host, propsStore }) {
  const client = createWebviewClient<Record<string, never>, typeof settings>(host);
  mount.innerHTML = '<button id="override">Use compact</button><button id="reset">Reset</button><button id="invalid">Invalid setting</button><output></output><pre id="all"></pre><pre id="validation"></pre><pre id="details"></pre><pre id="props"></pre><pre id="page"></pre><pre id="saved"></pre><button id="denied">Undeclared navigation</button><button id="page-update">Update page</button>';
  const showProps = () => { const props = propsStore.get(); mount.querySelector('#props').textContent = JSON.stringify({ keys: Object.keys(props).sort(), projectId: props.projectId, locale: props.locale, translations: props.translations.locale }); mount.querySelector('#page').textContent = JSON.stringify(client.page.params()); };
  const stopProps = propsStore.subscribe(showProps);
  const describeError = (error) => { if (!isWebviewCapabilityError(error)) throw error; mount.querySelector('#validation').textContent = error.message; mount.querySelector('#details').textContent = JSON.stringify({ code: error.code, data: error.data }); };
  mount.querySelector('#denied').onclick = async () => { try { await client.navigation.open({ kind: "href", href: "https://example.com" }); } catch (error) { describeError(error); } };
  mount.querySelector('#page-update').onclick = async () => { await client.page.updateParams({ tab: "files" }); };
  const show = async () => { mount.querySelector('output').textContent = await client.settings.get("density"); mount.querySelector('#all').textContent = JSON.stringify(await client.settings.all()); };
  mount.querySelector('#override').onclick = async () => { mount.querySelector("#saved").textContent = await client.settings.set("density", "compact"); await show(); };
  mount.querySelector('#reset').onclick = async () => { await client.settings.delete("density"); await show(); };
  mount.querySelector('#invalid').onclick = async () => { try { await host.call("extension.settings.set", { key: 7, value: "invalid" }); } catch (error) { describeError(error); } await show(); };
  showProps();
  void show();
  return stopProps;
} });
`,
  );
  return source;
};
