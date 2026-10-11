import { defineCommandPaletteResource, l10n, viewDataEvents } from "@pstdio/sdk/extensions";
import { notesFileAccess } from "./file-access";
import { listNotes, readNote } from "./notes";
import { note, notesChanged, notesMount, noteTarget } from "./pages";

export const noteResources = defineCommandPaletteResource({
  id: "notes",
  title: l10n("search.notes", "Notes"),
  resourceKind: note.ref,
  refreshEvents: [notesChanged, viewDataEvents.workspacesChanged],
  query: async (ctx, input) => {
    if (!(await notesFileAccess(ctx)).readable) return { items: [] };
    const mount = notesMount(ctx);
    const notes = await listNotes(mount);
    const query = input.query.trim().toLowerCase();
    const items = [];
    for (const note of notes) {
      if (items.length >= input.limit) break;
      if (query && !note.title.toLowerCase().includes(query)) {
        if (!(await readNote(mount, note.id)).toLowerCase().includes(query)) continue;
      }
      items.push({ id: note.id, label: note.title, icon: "file-text", target: noteTarget(note.id, note.title, ctx) });
    }
    return { items };
  },
});
