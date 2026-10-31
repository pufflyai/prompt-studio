import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createDb, createExtensionStorageDBService, projects } from "pstdio-db";
import { createWorkspaceContextFixture } from "../../features/extensions/workspace-context.test-fixture";
import { createNativeDocumentService } from "../native-documents/documents";
import { loadNativeMarkdownFile, saveNativeMarkdownFile } from "../native-documents/file-source";
import { resolveNativeTextAccess } from "../native-documents/source-access";
import { initializeNativeSource } from "../native-documents/source-binding";
import { createTextEditingService } from "./service";

export const textEditingFixture = async (
  options: {
    beforeDocumentLoad?: () => Promise<void>;
    beforeDocumentAccess?: () => Promise<void>;
    beforeProjection?: () => Promise<void>;
    afterProjection?: () => void;
  } = {},
) => {
  const extension = await createWorkspaceContextFixture();
  const database = await createDb({ path: ":memory:" });
  const timestamp = new Date().toISOString();
  await database.db
    .insert(projects)
    .values({ id: "project-1", name: "Project", shorthand: "P", created_at: timestamp, updated_at: timestamp });
  await writeFile(
    join(extension.root, "extension.ts"),
    `export default {
    textSources: [{ id: "body", ref: {kind: "text-source", id: "body"}, params: {},
      resolve: async ctx => {
        const path = (await ctx.workspaceFiles.exists("alternate-source")) ? "replacement.txt" : "notes.txt";
        return {source: {kind:"workspace",path},content:await ctx.workspaceFiles.readText(path),editable:!(await ctx.workspaceFiles.exists("read-only"))};
      },
      project: async (ctx, {content}) => { if (await ctx.workspaceFiles.exists("fail-project")) throw new Error("Project paused"); await ctx.workspaceFiles.writeText((await ctx.workspaceFiles.exists("alternate-source")) ? "replacement.txt" : "notes.txt", content); }
    }],
    views: [{id: "document", ref: {kind: "view", id: "document"}, title: "Document", body: {kind: "file", load: async ctx => ({textDocument: {sourceId: "body", params: {}}, textEditor: (await ctx.workspaceFiles.exists("native")) ? undefined : {extensionId: "thirdparty.editor",kind: "view",id: "code"}, fileName: "notes.md"})}}]
  };`,
  );
  const editor = join(extension.root, "editor");
  await mkdir(editor);
  await writeFile(
    join(editor, "package.json"),
    JSON.stringify({
      name: "editor",
      publisher: "thirdparty",
      version: "1.0.0",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      main: "./extension.ts",
    }),
  );
  await writeFile(
    join(editor, "extension.ts"),
    `export default {
    textSources: [{ id:"body",ref:{kind:"text-source",id:"body"},params:{},
      resolve: async ctx => ({source:{kind:"workspace",path:"editor-owned.txt"},content:await ctx.workspaceFiles.readText("editor-owned.txt"),editable:true}),
      project: async (ctx,{content})=>ctx.workspaceFiles.writeText("editor-owned.txt",content)
    }],
    views:[{id:"code",ref:{kind:"view",id:"code"},title:"Editor",body:{kind:"webview",entry:{kind:"package-asset",path:"./unused.ts",baseUrl:import.meta.url},capabilities:["editing.text"]}}]
  };`,
  );
  await writeFile(join(extension.root, "editor-owned.txt"), "Editor owned");
  let enabled = true;
  extension.deps.extensionService.listEnabledSourcesForProject = async () =>
    [
      extension.source,
      ...(enabled
        ? [
            {
              ...extension.source,
              instance: { id: "editor" },
              installedSource: {
                ...extension.source.installedSource,
                id: "editor",
                extension_id: "thirdparty.editor",
                source_path: editor,
              },
            },
          ]
        : []),
    ] as never;
  const deps = { ...extension.deps, extensionStorageService: createExtensionStorageDBService(database.db) };
  const load = (input: Parameters<typeof loadNativeMarkdownFile>[1]) => loadNativeMarkdownFile(deps, input);
  const access = (input: Parameters<typeof resolveNativeTextAccess>[1]) => resolveNativeTextAccess(deps, input);
  const documents = createNativeDocumentService({
    access: async (input) => {
      await options.beforeDocumentAccess?.();
      return access(input);
    },
    storage: deps.extensionStorageService,
    load: async (input) => {
      await options.beforeDocumentLoad?.();
      return load(input);
    },
    save: async (input) => {
      await options.beforeProjection?.();
      try {
        return await saveNativeMarkdownFile(deps, input);
      } finally {
        options.afterProjection?.();
      }
    },
    initialize: (loaded) => initializeNativeSource(deps, loaded),
    deviceId: "device",
    presenceIdentity: async () => ({ label: "Person", deviceName: "Device" }),
  });
  const createText = () => createTextEditingService({ documents, access, catalog: deps.extensionRuntimeCatalog });
  let text = createText();
  return {
    get text() {
      return text;
    },
    async restartText() {
      await text.dispose();
      text = createText();
    },
    documents,
    deps,
    root: extension.root,
    disableEditor() {
      enabled = false;
      deps.extensionRuntimeCatalog.invalidate({ projectId: "project-1", reason: "enablement_changed" });
    },
    cleanup: async () => {
      await text.dispose();
      await documents.dispose();
      await database.close();
      await extension.cleanup();
    },
  };
};
export const selected = { fileRendererId: "example.context.view.document" };
export const editorView = "thirdparty.editor.view.code";
