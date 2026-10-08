import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

/** Real SDK and extension modules exercise both the packaged and browser paths. */
export const writeCommandStreamExtension = (root: string) => {
  const source = join(root, "extensions", "stream-fixture");
  mkdirSync(source, { recursive: true });
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
      name: "stream-fixture",
      publisher: "test",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `
import { defineCommand, defineExtension, definePage, defineView, packageAsset, streamOf, workbenchModes } from "@pstdio/sdk/extensions";
let active = 0;
let cancelled = 0;
const wait = async (ctx) => {
  active++;
  try { await new Promise(resolve => { if (ctx.signal.aborted) resolve(); else ctx.signal.addEventListener("abort", resolve, { once: true }); }); }
  finally { active--; cancelled++; }
};
const tail = defineCommand({ id: "tail", title: "Tail", cli: true, stream: streamOf(), async run(ctx) {
  await ctx.stream.write({ line: "ready" }); await wait(ctx); return "stopped";
} });
const progress = defineCommand({ id: "progress", title: "Progress", cli: true, stream: streamOf(), async run(ctx) {
  for (let i=1; i<=3; i++) await ctx.stream.write({ done: i, total: 3 }); return { total: 3 };
} });
const plain = defineCommand({ id: "plain", title: "Plain", run: wait });
const state = defineCommand({ id: "state", title: "State", run: () => ({ active, cancelled }) });
const view = defineView({ id: "live", title: "Stream fixture", body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url), capabilities: ["commands.stream", "commands.execute"] } });
const page = definePage({ id: "live", title: "Live", path: "live", mode: workbenchModes.project, main: { kind: "view", view: view.ref, cardinality: "one" }, slots: [] });
export default defineExtension({ commands: [tail, progress, plain, state], views: [view], pages: [page] });
`,
  );
  writeFileSync(
    join(source, "view.ts"),
    `
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
export default defineExtensionView({ render({ mount, host }) {
  const client = createWebviewClient(host);
  mount.innerHTML = '<button id="start">Start streams</button><button id="stop">Stop streams</button><button id="plain">Plain command</button><button id="progress">Progress</button><output id="state">Idle</output>';
  const output = mount.querySelector('output');
  let streams = [];
  mount.querySelector('#start').onclick = () => {
    let count = 0;
    streams = Array.from({ length: 10 }, () => client.streams.tail());
    for (const stream of streams) {
      stream.result.catch(() => {});
      void (async () => { for await (const line of stream) { output.textContent = 'Live ' + (++count); } })();
    }
  };
  mount.querySelector('#stop').onclick = async () => { await Promise.all(streams.map(stream => stream.cancel())); output.textContent = 'Stopped'; };
  mount.querySelector('#plain').onclick = () => { output.textContent = 'Plain started'; void client.commands.plain().catch(() => {}); };
  mount.querySelector('#progress').onclick = async () => {
    const stream = client.streams.progress(); const chunks = [];
    for await (const chunk of stream) chunks.push(chunk.done);
    output.textContent = JSON.stringify({ chunks, result: await stream.result });
  };
} });
`,
  );
  return source;
};
