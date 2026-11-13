import {
  type CommandContext,
  defineCommand,
  type JsonObject,
  params,
  type ResourceAnchor,
  workbenchCommands,
  workbenchResourceKinds,
  workspaceSlots,
} from "@pstdio/sdk/extensions";
import { changed } from "./events";
import { selectionAfterDelete } from "./file-selection";
import { requireWorkspace } from "./files";
import { filePath, workspaceTarget } from "./model";
import { workspacePages } from "./refs";

const showForm = (ctx: CommandContext, operation: string, workspaceId?: string, path?: string) =>
  ctx.navigation.open({
    kind: "dialog",
    page: workspacePages.form,
    params: {
      operation,
      ...(workspaceId ? { "workspace-id": workspaceId } : {}),
      ...(path ? { path } : {}),
      ...(filePath(ctx.resource) ? { selected: filePath(ctx.resource)! } : {}),
    },
  });
const mutableWhen = {
  resourceType: [workbenchResourceKinds.workspace],
  metadata: { workspaceReadOnly: false, workspaceIsDefault: false },
};
export const showCreate = defineCommand({
  id: "show-create",
  title: "New workspace",
  cli: true,
  palette: [{ group: "Workspaces", icon: "folder-plus" }],
  params: {
    anchors: params.json({ resolvedFrom: "resource" }),
    shorthand_base: params.text({ resolvedFrom: "resource" }),
  },
  async run(ctx, args) {
    const providers = await ctx.workspaces.listProviders();
    const root = await ctx.workspaces.getDefault();
    if (!providers.length && !root?.rootPath) {
      ctx.navigation.open({ kind: "command", target: { command: workbenchCommands.chooseProjectFolder } });
      return;
    }
    ctx.navigation.open({
      kind: "dialog",
      page: workspacePages.create,
      params: {
        ...(args.anchors ? { anchors: JSON.stringify(args.anchors) } : {}),
        ...(args.shorthand_base ? { shorthand: args.shorthand_base } : {}),
      },
    });
  },
});
export const showRename = defineCommand({
  id: "show-rename",
  title: "Rename workspace",
  cli: true,
  params: { id: params.text({ resolvedFrom: "resource" }) },
  menus: [{ slot: workspaceSlots.headerOverflow, icon: "pencil", when: mutableWhen }],
  async run(ctx, args) {
    const workspace = await requireWorkspace(ctx, ctx.resource, args.id);
    if (workspace.isDefault) throw new Error("The project folder cannot be renamed here.");
    showForm(ctx, "rename", workspace.id);
  },
});
export const showDelete = defineCommand({
  id: "show-delete",
  title: "Delete workspace",
  mutating: true,
  resourceMutation: { kind: "remove", resourceType: "workspace", idParam: "id" },
  params: { id: params.text({ resolvedFrom: "resource" }) },
  menus: [
    {
      slot: workspaceSlots.headerOverflow,
      icon: "trash-2",
      when: { ...mutableWhen, metadata: { ...mutableWhen.metadata, workspaceSupportsDelete: true } },
    },
  ],
  async run(ctx, args) {
    const id = args.id ?? ctx.resource?.id;
    if (!id) throw new Error("Choose a workspace.");
    await remove.run(ctx, { id, confirmed: true });
  },
});
export const showDeleteEntry = defineCommand({
  id: "show-delete-entry",
  title: "Delete entry",
  cli: true,
  params: { path: params.text({ required: true, resolvedFrom: "resource" }) },
  async run(ctx, args) {
    const workspace = await requireWorkspace(ctx, ctx.resource);
    showForm(ctx, "delete-entry", workspace.id, args.path);
  },
});
export const rename = defineCommand({
  id: "rename",
  title: "Rename workspace",
  cli: true,
  mutating: true,
  params: { id: params.text({ required: true }), name: params.text({ required: true }) },
  async run(ctx, args) {
    const current = await requireWorkspace(ctx, undefined, args.id);
    if (current.isDefault) throw new Error("The project folder cannot be renamed here.");
    const workspace = await ctx.workspaces.rename(args.id, { name: args.name });
    await ctx.events.emit(changed, {});
    ctx.navigation.open(workspaceTarget(workspace, ctx.project.id));
    return workspace;
  },
});
export const remove = defineCommand({
  id: "delete",
  title: "Delete workspace",
  cli: true,
  mutating: true,
  params: { id: params.text({ required: true }), confirmed: params.boolean({ required: true }) },
  async run(ctx, args) {
    if (!args.confirmed) throw new Error("Confirm deleting this workspace.");
    const workspace = await requireWorkspace(ctx, undefined, args.id);
    if (workspace.isDefault || !workspace.capabilities?.delete) throw new Error("This workspace cannot be deleted.");
    await ctx.workspaces.delete(workspace.id);
    await ctx.events.emit(changed, {});
  },
});
export const removeEntry = defineCommand({
  id: "delete-entry",
  title: "Delete entry",
  cli: true,
  mutating: true,
  params: {
    workspaceId: params.text({ required: true }),
    path: params.text({ required: true }),
    confirmed: params.boolean({ required: true }),
    selected: params.text(),
  },
  async run(ctx, args) {
    if (!args.confirmed) throw new Error("Confirm deleting this entry.");
    const workspace = await requireWorkspace(ctx, undefined, args.workspaceId);
    await ctx.workspaces.deleteEntry(workspace.id, args.path);
    await ctx.events.emit(changed, {});
    const selected = selectionAfterDelete(args.selected ?? filePath(ctx.resource), args.path);
    ctx.navigation.open(workspaceTarget(workspace, ctx.project.id, selected ? { workspaceFilePath: selected } : {}));
  },
});
export const create = defineCommand({
  id: "create",
  title: "Create workspace",
  cli: true,
  mutating: true,
  params: {
    providerId: params.text({ required: true }),
    params: params.json<JsonObject>(),
    anchors: params.json<ResourceAnchor[]>(),
    shorthandBase: params.text(),
  },
  async run(ctx, args) {
    const workspace = await ctx.workspaces.create({
      providerId: args.providerId,
      params: args.params,
      anchors: args.anchors,
      shorthandBase: args.shorthandBase,
    });
    await ctx.events.emit(changed, {});
    ctx.navigation.open(workspaceTarget(workspace, ctx.project.id));
    return workspace;
  },
});
export const readForm = defineCommand({
  id: "read-form",
  title: "Read workspace action",
  cli: true,
  params: { workspaceId: params.text() },
  async run(ctx, args) {
    return {
      providers: await ctx.workspaces.listProviders(),
      workspace: args.workspaceId ? await ctx.workspaces.get(args.workspaceId) : null,
    };
  },
});
