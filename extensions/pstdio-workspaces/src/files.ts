import {
  defineCommand,
  defineView,
  type ExtensionContextBase,
  params,
  type ResourceRef,
  type TreeAction,
  type TreeNode,
  workbenchCommands,
  workbenchResourceKinds,
} from "@pstdio/sdk/extensions";
import { changed, refreshEvents } from "./events";
import { loadSelectedAncestors } from "./file-selection";
import { entryName, filePath, joinPath, parentPath, workspaceTarget } from "./model";
import { workspaceCommands, workspaceFileDocument } from "./refs";

export const requireWorkspace = async (ctx: ExtensionContextBase, resource?: ResourceRef, id?: string) => {
  const workspace = await ctx.workspaces.get(id ?? resource?.id ?? "");
  if (!workspace || workspace.device || workspace.projectId !== ctx.project.id)
    throw new Error("A workspace on this device is required.");
  return workspace;
};
const publish = async (ctx: ExtensionContextBase) => ctx.events.emit(changed, {});
const createParams = { parent: params.text(), name: params.text({ required: true }) };
export const createFile = defineCommand({
  id: "create-file",
  title: "New file",
  cli: true,
  mutating: true,
  params: createParams,
  async run(ctx, args) {
    const workspace = await requireWorkspace(ctx, ctx.resource);
    const path = joinPath(args.parent ?? "", args.name);
    await ctx.workspaces.createFile(workspace.id, path, { content: "" });
    await publish(ctx);
    ctx.navigation.open(workspaceTarget(workspace, ctx.project.id, { workspaceFilePath: path }));
  },
});
export const createDirectory = defineCommand({
  id: "create-directory",
  title: "New folder",
  cli: true,
  mutating: true,
  params: createParams,
  async run(ctx, args) {
    const workspace = await requireWorkspace(ctx, ctx.resource);
    await ctx.workspaces.createDirectory(workspace.id, joinPath(args.parent ?? "", args.name));
    await publish(ctx);
  },
});
export const renameEntry = defineCommand({
  id: "rename-entry",
  title: "Rename entry",
  cli: true,
  mutating: true,
  params: { path: params.text({ required: true }), name: params.text({ required: true }) },
  async run(ctx, args) {
    const workspace = await requireWorkspace(ctx, ctx.resource);
    const destination = joinPath(parentPath(args.path), entryName(args.name));
    if (destination === args.path) return;
    await ctx.workspaces.moveEntry(workspace.id, args.path, destination);
    await publish(ctx);
    const selected = filePath(ctx.resource);
    if (selected === args.path || selected?.startsWith(`${args.path}/`))
      ctx.navigation.open(
        workspaceTarget(workspace, ctx.project.id, {
          workspaceFilePath: destination + selected.slice(args.path.length),
        }),
      );
  },
});
const createAction = (parent: string, directory = false): TreeAction => ({
  id: directory ? "create-directory" : "create-file",
  label: directory ? "New folder" : "New file",
  icon: directory ? "folder-plus" : "file-plus-2",
  command: directory ? workspaceCommands.createDirectory : workspaceCommands.createFile,
  params: { parent },
  input: { name: { type: "text", label: directory ? "Folder name" : "File name", required: true } },
  inputPresentation: { kind: "inline", field: "name", placement: "child" },
});
const fileNode = (
  workspace: Awaited<ReturnType<typeof requireWorkspace>>,
  projectId: string,
  entry: { name: string; path: string; type: "file" | "directory" },
  selected?: string,
): TreeNode => {
  const writable = workspace.capabilities?.files === "write";
  const directory = entry.type === "directory";
  const actions: TreeAction[] = [
    { id: "copy-relative", label: "Copy relative path", icon: "copy", copyText: entry.path },
  ];
  if (workspace.rootPath) {
    const separator = workspace.rootPath.includes("\\") && !workspace.rootPath.includes("/") ? "\\" : "/";
    actions.unshift({
      id: "copy-path",
      label: "Copy path",
      icon: "copy",
      copyText: `${workspace.rootPath.replace(/[/\\]+$/, "")}${separator}${entry.path.split("/").join(separator)}`,
    });
  }
  actions.push({
    id: "reveal",
    label: "Reveal in Finder",
    icon: "folder-open",
    command: workbenchCommands.revealWorkspaceEntry,
    params: { path: entry.path },
    when: "workbench.desktop.canRevealFiles",
  });
  if (writable)
    actions.push(
      {
        id: "rename",
        label: "Rename",
        icon: "pencil",
        command: workspaceCommands.renameEntry,
        params: { path: entry.path, name: entry.name },
        input: { name: { type: "text", label: directory ? "Folder name" : "File name", required: true } },
        inputPresentation: { kind: "inline", field: "name", placement: "replace" },
      },
      {
        id: "delete",
        label: directory ? "Delete folder" : "Delete file",
        icon: "trash-2",
        command: workspaceCommands.deleteEntry,
        params: { path: entry.path },
      },
    );
  if (directory && writable) actions.unshift(createAction(entry.path), createAction(entry.path, true));
  return {
    id: entry.path,
    label: entry.name,
    tooltip: entry.path,
    rowVariant: "file",
    ...(directory
      ? { icon: "folder", collapsible: true }
      : { fileName: entry.name, target: workspaceTarget(workspace, projectId, { workspaceFilePath: entry.path }) }),
    selected: entry.path === selected,
    contextMenuActions: actions,
    canDrag: writable,
    canDrop: writable,
    metadata: { path: entry.path, type: entry.type },
  };
};
export const filesTree = defineView({
  id: "file-tree",
  title: "Files",
  icon: "files",
  body: {
    kind: "tree",
    resourceKind: workbenchResourceKinds.workspace,
    searchable: true,
    searchPlaceholder: "Search files",
    refreshEvents,
    async body(ctx, { renderer, filter }) {
      const workspace = await requireWorkspace(ctx, renderer.resource);
      if (
        !workspace.rootPath ||
        workspace.providerState !== "ready" ||
        workspace.initializing ||
        workspace.setupError ||
        workspace.capabilities?.files === "none"
      )
        return [
          {
            id: "files",
            nodes:
              workspace.isDefault && !workspace.rootPath
                ? [
                    {
                      id: "choose-folder",
                      label: "Choose a folder",
                      icon: "folder-open",
                      target: { kind: "command", target: { command: workbenchCommands.chooseProjectFolder } },
                    },
                  ]
                : [],
            emptyState: {
              title: workspace.setupError ?? "Files unavailable",
              description: "Files require a ready workspace with file access.",
            },
          },
        ];
      const result = await ctx.workspaces.listFiles(workspace.id, { query: filter, limit: 500 });
      let nodes = result.entries.map((entry) =>
        fileNode(workspace, ctx.project.id, entry, filePath(renderer.resource)),
      );
      if (!filter)
        nodes = await loadSelectedAncestors(nodes, filePath(renderer.resource), async (path) =>
          (await ctx.workspaces.listFiles(workspace.id, { path, limit: 500 })).entries.map((entry) =>
            fileNode(workspace, ctx.project.id, entry, filePath(renderer.resource)),
          ),
        );
      if (result.truncated)
        nodes.push({
          id: "workbench:search-truncated",
          label: "More files match. Refine your search.",
          rowVariant: "empty-state",
          disabled: true,
        });
      return [
        {
          id: "files",
          label: "Files",
          collapsible: false,
          actions: workspace.capabilities?.files === "write" ? [createAction(""), createAction("", true)] : [],
          nodes,
        },
      ];
    },
    async children(ctx, { node, renderer }) {
      const workspace = await requireWorkspace(ctx, renderer.resource);
      return (await ctx.workspaces.listFiles(workspace.id, { path: node.id, limit: 500 })).entries.map((entry) =>
        fileNode(workspace, ctx.project.id, entry, filePath(renderer.resource)),
      );
    },
    async onMove(ctx, { source, target, renderer, position }) {
      const workspace = await requireWorkspace(ctx, renderer.resource);
      const parent =
        target?.metadata?.type === "directory" && position === "inside" ? target.id : parentPath(target?.id ?? "");
      const destination = joinPath(parent, source.id.split("/").at(-1)!);
      if (destination === source.id) return;
      await ctx.workspaces.moveEntry(workspace.id, source.id, destination);
      await publish(ctx);
      const selected = filePath(renderer.resource);
      if (selected === source.id || selected?.startsWith(`${source.id}/`))
        ctx.navigation.open(
          workspaceTarget(workspace, ctx.project.id, {
            workspaceFilePath: destination + selected.slice(source.id.length),
          }),
        );
    },
  },
});
export const fileView = defineView({
  id: "file",
  title: "Files",
  icon: "files",
  body: {
    kind: "file",
    resourceKind: workbenchResourceKinds.workspace,
    saveMode: "manual",
    document: workspaceFileDocument,
    refreshEvents,
    async load(ctx, { renderer }) {
      const workspace = await requireWorkspace(ctx, renderer.resource);
      const path = filePath(renderer.resource);
      if (!path)
        return {
          emptyState: { title: "Select a file", description: "Choose a file from the tree or use Search files." },
        };
      const file = await ctx.workspaces.readFile(workspace.id, path);
      return {
        fileName: file.file_name,
        filePath: path,
        mimeType: file.mime_type,
        content: file.content,
        dataUrl: file.data_url,
        editable: file.editable && workspace.capabilities?.files === "write",
        textRenderer: "monaco",
      };
    },
    async save(ctx, { renderer, content }) {
      const workspace = await requireWorkspace(ctx, renderer.resource);
      const path = filePath(renderer.resource);
      if (!path) throw new Error("Select a file before saving.");
      await ctx.workspaces.writeFile(workspace.id, path, { content });
      await publish(ctx);
    },
  },
});
