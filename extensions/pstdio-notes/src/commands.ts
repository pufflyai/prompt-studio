import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { createNote, deleteNote } from "./notes";
import { notesChanged, notesMount, noteTarget } from "./pages";

export const createNoteCommand = defineCommand({
  id: "notes.create",
  title: l10n("commands.createNote", "New note"),
  cli: true,
  mutating: true,
  params: {
    title: params.text({ label: l10n("params.title", "Title"), required: true }),
  },
  async run(ctx, commandParams) {
    const note = await createNote(notesMount(ctx), commandParams.title);
    await ctx.events.emit(notesChanged, { noteId: note.id });

    ctx.navigation.open(noteTarget(note.id, note.title));
    return note;
  },
});

export const deleteNoteCommand = defineCommand({
  id: "notes.delete",
  title: l10n("commands.deleteNote", "Delete note"),
  cli: true,
  mutating: true,
  params: {
    noteId: params.text({ label: l10n("params.noteId", "Note"), required: true }),
  },
  async run(ctx, commandParams) {
    const mount = notesMount(ctx);
    await deleteNote(mount, commandParams.noteId);
    await ctx.resources.removed({ type: "note", id: commandParams.noteId });
    await ctx.events.emit(notesChanged, { noteId: commandParams.noteId });

    return { id: commandParams.noteId };
  },
});
