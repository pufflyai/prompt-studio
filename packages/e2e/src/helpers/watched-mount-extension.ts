import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

/** An extension whose webview lists the files of a watched artifact mount, using the in-repo SDK. */
export const writeWatchedMountExtension = (root: string) => {
  const source = join(root, "extensions", "board-fixture");
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
      name: "board-fixture",
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
import { defineArtifactMount, defineCommand, defineExtension, definePage, defineView, packageAsset, workbenchModes } from "@pstdio/sdk/extensions";
const boards = defineArtifactMount({ id: "boards", path: "boards", label: "Boards", watch: true });
const list = defineCommand({ id: "list", title: "List boards", async run(ctx) {
  return (await ctx.artifacts.mount(boards.id).list("*.json")).map((file) => file.path);
} });
const save = defineCommand({ id: "save", title: "Save board", async run(ctx) {
  await ctx.artifacts.mount(boards.id).writeText("saved.json", "{}");
} });
const view = defineView({ id: "boards", title: "Board fixture", body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url), capabilities: ["commands.execute"] } });
const page = definePage({ id: "boards", title: "Boards", path: "boards", mode: workbenchModes.project, main: { kind: "view", view: view.ref, cardinality: "one" }, slots: [] });
export default defineExtension({ artifactMounts: [boards], commands: [list, save], views: [view], pages: [page] });
`,
  );
  writeFileSync(
    join(source, "view.ts"),
    `
import { artifactChanged, createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
export default defineExtensionView({ render({ mount, host }) {
  const client = createWebviewClient(host);
  mount.innerHTML = '<output>Loading</output>';
  const output = mount.querySelector('output');
  let loads = 0;
  const load = async () => {
    const files = await client.commands.list();
    loads++;
    output.textContent = 'Load ' + loads + ': ' + (files.join(', ') || 'no boards');
  };
  client.events.subscribe(artifactChanged({ id: "boards" }), () => void load());
  void load();
} });
`,
  );
  return source;
};
