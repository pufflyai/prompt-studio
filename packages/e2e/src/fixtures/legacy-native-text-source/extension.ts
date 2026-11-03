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
const seed = defineCommand({
  id: "seed",
  title: "Create a legacy Markdown document",
  run: (ctx) => ctx.artifacts.mount(documents.id).writeText("shared.md", "Shared legacy text"),
});
const body = defineTextSource({
  id: "body",
  params: {},
  resolve: async (ctx) => ({
    source: { kind: "artifact", mount: documents.id, path: "shared.md", identity: "shared" },
    content: await ctx.artifacts.mount(documents.id).readText("shared.md"),
    editable: true,
  }),
  project: (ctx, { content }) => ctx.artifacts.mount(documents.id).writeText("shared.md", content),
});
const view = (id: string, foreign: boolean) =>
  defineView({
    id,
    title: foreign ? "Installed legacy document" : "Native legacy document",
    body: {
      kind: "file",
      load: async (ctx) => ({
        ...(foreign
          ? { textDocument: { sourceId: body.id, params: {} } }
          : {
              documentSource: { kind: "artifact" as const, mount: documents.id, path: "shared.md", identity: "shared" },
            }),
        fileName: "shared.md",
        content: await ctx.artifacts.mount(documents.id).readText("shared.md"),
        textEditor: foreign ? qualifyRef("ink.public-text-editor", { kind: "view", id: "editor" }) : undefined,
      }),
      save: (ctx, { content }) => ctx.artifacts.mount(documents.id).writeText("shared.md", content),
    },
  });
const native = view("native", false);
const custom = view("custom", true);
const page = (target: typeof native) =>
  definePage({
    id: target.id,
    title: target.title,
    path: target.id,
    mode: workbenchModes.project,
    main: { kind: "view", view: target.ref, cardinality: "one" },
    slots: [],
  });

export default defineExtension({
  artifactMounts: [documents],
  textSources: [body],
  commands: [seed],
  views: [native, custom],
  pages: [page(native), page(custom)],
});
