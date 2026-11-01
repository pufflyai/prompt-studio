import {
  defineArtifactMount,
  defineCommand,
  defineExtension,
  definePage,
  defineTextSource,
  defineView,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const documents = defineArtifactMount({ id: "documents", path: "documents", label: "Documents" });
const own = defineTextSource({
  id: "own",
  params: {},
  async resolve(ctx) {
    return {
      source: { kind: "artifact", mount: documents.id, path: "own.md", identity: "own" },
      content: await ctx.artifacts.mount(documents.id).readText("own.md"),
      editable: true,
    };
  },
  project: (ctx, { content }) => ctx.artifacts.mount(documents.id).writeText("own.md", content),
});
const seed = defineCommand({
  id: "seed",
  title: "Create an editor-owned document",
  run: (ctx) => ctx.artifacts.mount(documents.id).writeText("own.md", "Editor source"),
});
const editor = defineView({
  id: "editor",
  title: "Installed text editor",
  body: {
    kind: "webview",
    entry: packageAsset("./view.tsx", import.meta.url),
    capabilities: ["editing.text"],
  },
});
const page = definePage({
  id: "own",
  title: "Editor document",
  path: "own",
  mode: workbenchModes.project,
  main: { kind: "view", view: editor.ref, cardinality: "one" },
  slots: [],
});

export default defineExtension({
  artifactMounts: [documents],
  textSources: [own],
  commands: [seed],
  views: [editor],
  pages: [page],
});
