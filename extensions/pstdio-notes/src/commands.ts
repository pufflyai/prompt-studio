import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { notesFileAccess } from "./file-access";
import { moveNote, requireFolder } from "./folders";
import {
  createNote,
  deleteNote,
  hasSavedNoteTitle,
  noteExists,
  readExistingNoteTitle,
  readNoteTitle,
  renameNote,
} from "./notes";
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
    const title = await readExistingNoteTitle(notesMount(ctx), input.noteId);
    return title === undefined ? null : noteResource(input.noteId, title, ctx, writable);
  },
});

export const resolveNoteOpeningCommand = defineCommand({
  id: "notes.resolve-opening",
  title: l10n("commands.resolveNoteOpening", "Resolve note opening"),
  params: { noteId: params.text({ required: true, resolvedFrom: "resource" }) },
  async run(ctx, input) {
    const { readable, writable } = await notesFileAccess(ctx);
    if (!readable) return null;
    const title = await readExistingNoteTitle(notesMount(ctx), input.noteId);
    return title === undefined ? null : noteTarget(input.noteId, title, ctx, writable);
  },
});

export const createNoteCommand = defineCommand({
  id: "notes.create",
  title: l10n("commands.createNote", "New note"),
  cli: { path: ["create"] },
  palette: [{ group: "Notes", icon: "sticky-note", params: {} }],
  mutating: true,
  params: {
    title: params.text({ label: l10n("params.title", "Title") }),
    folderId: params.text({ label: l10n("params.folder", "Folder") }),
  },
  async run(ctx, commandParams) {
    const { writable } = await notesFileAccess(ctx);
    if (commandParams.folderId) await requireFolder(notesMount(ctx), commandParams.folderId);
    const note = await createNote(notesMount(ctx), ctx.storage.ids.create(), commandParams.title);
    if (commandParams.folderId) await moveNote(notesMount(ctx), note.id, commandParams.folderId);
    await ctx.events.emit(notesChanged, { noteId: note.id });

    ctx.navigation.open(noteTarget(note.id, note.title, ctx, writable));
    return note;
  },
});

export const deleteNoteCommand = defineCommand({
  id: "notes.delete",
  resourceMutation: { kind: "remove", resourceType: "note", idParam: "noteId" },
  title: l10n("commands.deleteNote", "Delete note"),
  cli: { path: ["delete"] },
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
  cli: { path: ["rename"] },
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

export const checkNoteTitleCommand = defineCommand({
  id: "notes.check-title",
  title: l10n("commands.checkNoteTitle", "Check saved note title"),
  params: {
    noteId: params.text({ required: true, resolvedFrom: "resource" }),
    title: params.text({ required: true }),
  },
  async run(ctx, { noteId, title }) {
    if (!(await notesFileAccess(ctx)).readable) return { confirmed: false };
    return { confirmed: await hasSavedNoteTitle(notesMount(ctx), noteId, title.trim()) };
  },
});

export const resolveNotesCommand = defineCommand({
  id: "notes.resolve-many",
  title: l10n("activity.resolve", "Resolve notes"),
  params: { resources: params.json<import("@pstdio/sdk/extensions").ResourceRef[]>() },
  async run(ctx, input) {
    const access = await notesFileAccess(ctx);
    if (!access.readable) return [];
    const results = [];
    for (const resource of input.resources ?? []) {
      if (await noteExists(notesMount(ctx), resource.id))
        results.push({
          resource: noteResource(resource.id, await readNoteTitle(notesMount(ctx), resource.id), ctx, access.writable),
        });
    }
    return results;
  },
});
