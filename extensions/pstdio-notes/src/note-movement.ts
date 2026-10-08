import { moveNote } from "./folders";
import { listNotes, type NotesMount, noteExists, noteOrderPath } from "./notes";

export const moveTreeNote = async (mount: NotesMount, sourceId: string, targetId: string) => {
  if (sourceId === targetId) return;
  if (!(await noteExists(mount, sourceId))) throw new Error("Note not found.");
  const notes = await listNotes(mount);
  let folderId: string | undefined;
  const target = notes.find((note) => note.id === targetId);
  if (targetId.startsWith("folder:")) folderId = targetId.slice("folder:".length);
  else if (targetId !== "notes") {
    if (!target) throw new Error("Note not found.");
    folderId = target.folderId;
  }
  await moveNote(mount, sourceId, folderId);
  const order = notes.filter((note) => note.id !== sourceId).map((note) => note.id);
  const index = target ? order.indexOf(target.id) : order.length;
  order.splice(index, 0, sourceId);
  await mount.writeText(noteOrderPath, JSON.stringify(order));
};
