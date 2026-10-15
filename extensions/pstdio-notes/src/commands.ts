import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { notesFileAccess } from "./file-access";
import { moveNote, requireFolder } from "./folders";
import { createNote, deleteNote, noteExists, readNoteTitle, renameNote } from "./notes";
import { noteResource, notesChanged, notesMount, noteTarget } from "./pages";
import { noteActionsSlot } from "./resource-kinds";

const requireWritable = async (ctx: Parameters<typeof notesFileAccess>[0]) => {
  if (!(await notesFileAccess(ctx)).writable) throw new Error("Notes are read-only.");
};
const noteMenu = {
  slot: noteActionsSlot,
  disabledWhen: { metadata: { writable: false } },
  disabledReason: l10n("resources.readOnly", "Notes are read-only."),
};
export const resolveNoteCommand = defineCommand({
  id: "notes.resolve",
  title: l10n("commands.resolveNote", "Resolve note"),
  params: { noteId: params.text({ required: true, resolvedFrom: "resource" }) },
  async run(ctx, input) {
    const { readable, writable } = await notesFileAccess(ctx);
    if (!readable) return noteResource(input.noteId, ctx.resource?.label ?? input.noteId, ctx, false);
    const mount = notesMount(ctx);
    if (!(await noteExists(mount, input.noteId))) return null;
    return noteResource(input.noteId, await readNoteTitle(mount, input.noteId), ctx, writable);
  },
});

export const createNoteCommand = defineCommand({
  id: "notes.create",
  title: l10n("commands.createNote", "New note"),
  cli: true,
  palette: [{ group: "Notes", icon: "sticky-note" }],
  mutating: true,
  params: {
    title: params.text({ label: l10n("params.title", "Title") }),
    folderId: params.text({ label: l10n("params.folder", "Folder") }),
  },
  async run(ctx, commandParams) {
    if (commandParams.folderId) await requireFolder(notesMount(ctx), commandParams.folderId);
    const note = await createNote(notesMount(ctx), commandParams.title);
    if (commandParams.folderId) await moveNote(notesMount(ctx), note.id, commandParams.folderId);
    await ctx.events.emit(notesChanged, { noteId: note.id });

    ctx.navigation.open(noteTarget(note.id, note.title, ctx));
    return note;
  },
});

export const deleteNoteCommand = defineCommand({
  id: "notes.delete",
  resourceMutation: { kind: "remove", resourceType: "note", idParam: "noteId" },
  title: l10n("commands.deleteNote", "Delete note"),
  cli: true,
  mutating: true,
  menus: [{ ...noteMenu, label: l10n("tree.actions.deleteNote", "Delete"), icon: "trash" }],
  params: {
    noteId: params.text({ label: l10n("params.noteId", "Note"), required: true, resolvedFrom: "resource" }),
  },
  async run(ctx, commandParams) {
    await requireWritable(ctx);
    const mount = notesMount(ctx);
    await deleteNote(mount, commandParams.noteId);
    await ctx.resources.removed({ type: "note", id: commandParams.noteId });
    await ctx.events.emit(notesChanged, { noteId: commandParams.noteId });

    return { id: commandParams.noteId };
  },
});

export const renameNoteCommand = defineCommand({
  id: "notes.rename",
  resourceMutation: { kind: "rename", resourceType: "note", idParam: "noteId", labelParam: "title" },
  title: l10n("commands.renameNote", "Rename note"),
  cli: true,
  mutating: true,
  menus: [{ ...noteMenu, placement: "first", label: l10n("tree.actions.renameNote", "Rename note"), icon: "pencil" }],
  params: {
    noteId: params.text({ label: l10n("params.noteId", "Note"), required: true, resolvedFrom: "resource" }),
    title: params.text({ label: l10n("params.title", "Title"), required: true }),
  },
  async run(ctx, commandParams) {
    await requireWritable(ctx);
    const note = await renameNote(notesMount(ctx), commandParams.noteId, commandParams.title);
    await ctx.events.emit(notesChanged, { noteId: note.id });
    return note;
  },
});
