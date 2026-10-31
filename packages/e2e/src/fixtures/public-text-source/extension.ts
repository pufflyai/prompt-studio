import {
  defineArtifactMount,
  defineCommand,
  defineExtension,
  definePage,
  defineTextSource,
  defineView,
  qualifyRef,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const documents = defineArtifactMount({ id: "documents", path: "documents", label: "Documents" });
const body = defineTextSource({
  id: "body",
  params: {},
  async resolve(ctx) {
    return {
      source: { kind: "artifact", mount: documents.id, path: "selected.md", identity: "selected" },
      content: await ctx.artifacts.mount(documents.id).readText("selected.md"),
      editable: true,
    };
  },
  project: (ctx, { content }) => ctx.artifacts.mount(documents.id).writeText("selected.md", content),
});
const privateBody = defineTextSource({
  id: "private-body",
  params: {},
  async resolve(ctx) {
    return {
      source: { kind: "artifact", mount: documents.id, path: "private.md", identity: "private" },
      content: await ctx.artifacts.mount(documents.id).readText("private.md"),
      editable: true,
    };
  },
  project: (ctx, { content }) => ctx.artifacts.mount(documents.id).writeText("private.md", content),
});
const seed = defineCommand({
  id: "seed",
  title: "Create text documents",
  async run(ctx) {
    const files = ctx.artifacts.mount(documents.id);
    await files.writeText("selected.md", "Shared source");
    await files.writeText("private.md", "Source owner private text");
  },
});
const selected = defineView({
  id: "selected",
  title: "Shared document",
  body: {
    kind: "file",
    load: async () => ({
      fileName: "selected.md",
      mimeType: "text/markdown",
      textDocument: { sourceId: body.id, params: {} },
      textEditor: qualifyRef("ink.public-text-editor", { kind: "view", id: "editor" }),
    }),
  },
});
const native = defineView({
  id: "native",
  title: "Native shared document",
  body: {
    kind: "file",
    load: async () => ({
      fileName: "selected.md",
      mimeType: "text/markdown",
      textDocument: { sourceId: body.id, params: {} },
    }),
  },
});
const shared = definePage({
  id: "shared",
  title: "Shared document",
  path: "shared",
  mode: workbenchModes.project,
  main: { kind: "view", view: selected.ref, cardinality: "one" },
  slots: [],
});

const nativePage = definePage({
  id: "native",
  title: "Native shared document",
  path: "native",
  mode: workbenchModes.project,
  main: { kind: "view", view: native.ref, cardinality: "one" },
  slots: [],
});

export default defineExtension({
  artifactMounts: [documents],
  textSources: [body, privateBody],
  commands: [seed],
  views: [selected, native],
  pages: [shared, nativePage],
});
