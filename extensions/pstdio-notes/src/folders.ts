import { listNotes, type NotesMount, noteExists, noteFolderPath } from "./notes";

const folderPath = (id: string) => `.folders/${id}/title.txt`;
const folderTitle = (name: string) => {
  const title = name.trim();
  if (!title) throw new Error("A folder name is required.");
  return title;
};

export const requireFolder = async (mount: NotesMount, id: string) => {
  if (!(await mount.exists(folderPath(id)))) throw new Error("Folder not found.");
};

export const listFolders = async (mount: NotesMount) => {
  const files = await mount.list(".folders/*/title.txt");
  const folders = await Promise.all(
    files.map(async ({ path }) => ({
      id: path.slice(".folders/".length, -"/title.txt".length),
      title: await mount.readText(path),
    })),
  );
  return folders.sort((a, b) => a.title.localeCompare(b.title));
};

export const createFolder = async (mount: NotesMount, name: string) => {
  const title = folderTitle(name);
  const id = crypto.randomUUID();
  await mount.writeText(folderPath(id), title);
  return { id, title };
};

export const renameFolder = async (mount: NotesMount, id: string, name: string) => {
  const title = folderTitle(name);
  await mount.updateText(folderPath(id), title);
  return { id, title };
};

export const moveNote = async (mount: NotesMount, id: string, folderId?: string) => {
  if (!(await noteExists(mount, id))) throw new Error("Note not found.");
  if (folderId) await requireFolder(mount, folderId);
  if (folderId) await mount.writeText(noteFolderPath(id), folderId);
  else if (await mount.exists(noteFolderPath(id))) await mount.delete(noteFolderPath(id));
  return { id, folderId };
};

export const deleteFolder = async (mount: NotesMount, id: string) => {
  const notes = await listNotes(mount);
  await Promise.all(notes.filter((note) => note.folderId === id).map((note) => moveNote(mount, note.id)));
  await mount.delete(`.folders/${id}`);
  return { id };
};
