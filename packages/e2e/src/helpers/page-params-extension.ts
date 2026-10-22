import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writePageParamsExtension = (root: string) => {
  const sourcePath = join(root, ".pstdio", "extensions", "page-params");
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "page-params",
      publisher: "test",
      displayName: "Page params",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `
    const ref = (kind, id) => ({ kind, id });
    const board = ref("view", "board");
    const table = ref("view", "table");
    const params = { range: { type: "string", default: "now-1h" }, refresh: { type: "number", default: 30 } };
    const mode = { kind: "mode", extensionId: "pstdio", id: "project" };
    export default {
      views: [
        { id: "board", ref: board, title: "Page params", body: { kind: "webview", entry: { kind: "package-asset", path: "./view.ts", baseUrl: import.meta.url }, capabilities: ["navigation.open", "page.params.update", "preferences.get", "preferences.set"] } },
        { id: "table", ref: table, title: "Range rows", body: { kind: "dataTable", query: async (_ctx, { renderer }) => ({ rows: [{ id: "range", values: { range: renderer.pageParams?.range ?? "missing" } }], columns: [{ id: "range", label: "Native range" }] }) } },
      ],
      pages: [
        { id: "board", ref: ref("page", "board"), title: "Page params", path: "board", mode, params, main: { kind: "view", view: board, cardinality: "one" }, slots: [{ id: "rows", region: "side", item: { kind: "view", view: table, presence: "open" } }], panels: {} },
        { id: "details", ref: ref("page", "details"), title: "Details", path: "details", mode, params, main: { kind: "view", view: board, cardinality: "one" }, slots: [], panels: {} },
      ],
    };
  `,
  );
  writeFileSync(
    join(sourcePath, "view.ts"),
    `
    export default { mount(mount, host, propsStore) {
      mount.innerHTML = '<h1>Page params fixture</h1><p id="range"></p><p id="saved"></p><p id="error"></p><button id="update">Update range</button><button id="navigate">Navigate range</button><button id="details">Open details</button><button id="invalid">Invalid param</button><button id="save">Save preference</button><button id="read">Read preference</button>';
      const error = (e) => { mount.querySelector('#error').textContent = String(e.message ?? e); };
      const draw = () => { mount.querySelector('#range').textContent = propsStore.get().pageParams?.range ?? 'missing'; };
      draw();
      const stop = propsStore.subscribe(draw);
      const read = async () => { mount.querySelector('#saved').textContent = await host.call('preferences.get', { name: 'lastRange' }) ?? 'unset'; };
      const initialRead = read().catch(error);
      mount.querySelector('#update').onclick = () => host.call('page.params.update', { params: { range: 'now-24h' } }).catch(error);
      mount.querySelector('#navigate').onclick = () => host.call('navigation.open', { target: { kind: 'page', page: { kind: 'page', id: 'board', extensionId: 'test.page-params' }, params: { range: 'now-7d' } } }).catch(error);
      mount.querySelector('#details').onclick = () => host.call('navigation.open', { target: { kind: 'page', page: { kind: 'page', id: 'details', extensionId: 'test.page-params' }, params: { range: 'now-7d' }, parent: { kind: 'page', page: { kind: 'page', id: 'board', extensionId: 'test.page-params' }, params: propsStore.get().pageLocation.params } } }).catch(error);
      mount.querySelector('#invalid').onclick = () => host.call('page.params.update', { params: { refresh: 'bad' } }).catch(error);
      mount.querySelector('#save').onclick = async () => { try { await initialRead; await host.call('preferences.set', { name: 'lastRange', value: propsStore.get().pageParams.range }); await read(); } catch(e) { error(e); } };
      mount.querySelector('#read').onclick = () => read().catch(error);
      return stop;
    } };
  `,
  );
  return sourcePath;
};
