import type { ArtifactMount } from "@pstdio/sdk/extensions";

export type NotesMount = Pick<ArtifactMount, "exists" | "list" | "readText" | "writeText" | "updateText" | "delete">;

const CONTENT_PATH = "/content.md";
const notePath = (id: string) => `${id}${CONTENT_PATH}`;
const titlePath = (id: string) => `${id}/title.txt`;
export const noteFolderPath = (id: string) => `${id}/folder.txt`;

const readNoteFolder = async (mount: NotesMount, id: string) =>
  (await mount.exists(noteFolderPath(id))) ? (await mount.readText(noteFolderPath(id))) || undefined : undefined;

const noteTitle = (rawTitle: string) => {
  const title = rawTitle.trim();
  if (!title) throw new Error("A note title is required.");
  return title;
};

export const noteExists = (mount: NotesMount, id: string) => mount.exists(notePath(id));
export const readNote = (mount: NotesMount, id: string) => mount.readText(notePath(id));
export const readNoteTitle = async (mount: NotesMount, id: string) => {
  const title = await mount.readText(titlePath(id));
  if (title) return title;
  const opening = (await readNote(mount, id)).trimStart().split(/\r?\n/, 1)[0];
  return (
    opening
      .replace(/^\s*(?:#{1,6}\s+|>\s+|[-*+]\s+|\d+[.)]\s+)/, "")
      .trim()
      .slice(0, 80) || "New note"
  );
};
export const writeNote = (mount: NotesMount, id: string, content: string) => mount.updateText(notePath(id), content);
export const deleteNote = (mount: NotesMount, id: string) => mount.delete(id);

export const renameNote = async (mount: NotesMount, id: string, rawTitle: string) => {
  const title = noteTitle(rawTitle);
  // Title and body have separate owners, so autosave cannot overwrite a concurrent rename.
  await mount.updateText(titlePath(id), title);
  return { id, title };
};

export const listNotes = async (mount: NotesMount) => {
  const files = await mount.list(`*${CONTENT_PATH}`);
  const notes = await Promise.all(
    files.map(async (file) => {
      const id = file.path.slice(0, -CONTENT_PATH.length);
      try {
        return {
          id,
          title: await readNoteTitle(mount, id),
          folderId: await readNoteFolder(mount, id),
          updatedAt: file.updatedAt ?? "",
        };
      } catch (error) {
        if (!(await noteExists(mount, id))) return undefined;
        throw error;
      }
    }),
  );
  return notes
    .filter((note) => note !== undefined)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
};

export const createNote = async (mount: NotesMount, rawTitle?: string) => {
  // An empty saved title means the content owns the title until the user renames it.
  const title = rawTitle === undefined ? "" : noteTitle(rawTitle);
  const id = crypto.randomUUID();
  // Publish the body last so a listed note always has a title.
  await mount.writeText(titlePath(id), title);
  await mount.writeText(notePath(id), "");
  return { id, title: title || "New note" };
};
