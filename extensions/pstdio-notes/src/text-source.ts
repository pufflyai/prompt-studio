import { defineTextSource, params } from "@pstdio/sdk/extensions";
import { notesChanged } from "./events";
import { notesFileAccess } from "./file-access";
import { documents } from "./mounts";
import { notePath, readNoteSource, writeNoteSource } from "./notes";

export const noteText = defineTextSource({
  id: "note",
  params: { noteId: params.text({ required: true }) },
  async resolve(ctx, { params: { noteId } }) {
    const access = await notesFileAccess(ctx);
    if (!access.readable) throw new Error("Notes unavailable: open a ready local project folder.");
    return {
      source: { kind: "artifact", mount: documents.id, path: notePath(noteId), identity: noteId },
      content: await readNoteSource(ctx.artifacts.mount(documents.id), noteId),
      editable: access.writable,
    };
  },
  async project(ctx, { params: { noteId }, content }) {
    if (!(await notesFileAccess(ctx)).writable) throw new Error("This note is read only.");
    await writeNoteSource(ctx.artifacts.mount(documents.id), noteId, content);
    await ctx.events.emit(notesChanged, { noteId });
  },
});
