import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { createFolder, deleteFolder, moveNote, renameFolder } from "./folders";
import { notesChanged, notesMount } from "./pages";
import { writeResourceInOrder } from "./resource-writes";

export const createFolderCommand = defineCommand({
  id: "folders.create",
  title: l10n("commands.createFolder", "New folder"),
  cli: true,
  mutating: true,
  params: { title: params.text({ label: l10n("params.folderName", "Folder name"), required: true }) },
  async run(ctx, input) {
    const folder = await writeResourceInOrder(`folders:${ctx.projectId}`, () =>
      createFolder(notesMount(ctx), input.title),
    );
    await ctx.events.emit(notesChanged, {});
    return folder;
  },
});

export const renameFolderCommand = defineCommand({
  id: "folders.rename",
  title: l10n("commands.renameFolder", "Rename folder"),
  cli: true,
  mutating: true,
  params: {
    folderId: params.text({ label: l10n("params.folder", "Folder"), required: true }),
    title: params.text({ label: l10n("params.folderName", "Folder name"), required: true }),
  },
  async run(ctx, input) {
    const folder = await writeResourceInOrder(`folders:${ctx.projectId}`, () =>
      renameFolder(notesMount(ctx), input.folderId, input.title),
    );
    await ctx.events.emit(notesChanged, {});
    return folder;
  },
});

export const deleteFolderCommand = defineCommand({
  id: "folders.delete",
  title: l10n("commands.deleteFolder", "Remove folder"),
  cli: true,
  mutating: true,
  params: { folderId: params.text({ label: l10n("params.folder", "Folder"), required: true }) },
  async run(ctx, input) {
    const result = await writeResourceInOrder(`folders:${ctx.projectId}`, () =>
      deleteFolder(notesMount(ctx), input.folderId),
    );
    await ctx.events.emit(notesChanged, {});
    return result;
  },
});

export const moveNoteCommand = defineCommand({
  id: "notes.move",
  title: l10n("commands.moveNote", "Move note"),
  cli: true,
  mutating: true,
  params: {
    noteId: params.text({ label: l10n("params.noteId", "Note"), required: true }),
    folderId: params.text({ label: l10n("params.folder", "Folder") }),
  },
  async run(ctx, input) {
    const result = await moveNote(
      notesMount(ctx),
      input.noteId,
      input.folderId === "notes" ? undefined : input.folderId,
    );
    await ctx.events.emit(notesChanged, { noteId: input.noteId });
    return result;
  },
});
