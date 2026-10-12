import type { ArtifactMount } from "@pstdio/sdk/extensions";
import { buildNoteDocument, firstNoteTitle, parseNoteDocument } from "./note-frontmatter";
import { writeResourceInOrder } from "./resource-writes";

export type NotesMount = Pick<ArtifactMount, "exists" | "list" | "readText" | "writeText" | "updateText" | "delete">;

const CONTENT_PATH = "/content.md";
const notePath = (id: string) => `${id}${CONTENT_PATH}`;
const titlePath = (id: string) => `${id}/title.txt`;
export const noteOrderPath = ".order.json";
export const noteFolderPath = (id: string) => `${id}/folder.txt`;

const readNoteFolder = async (mount: NotesMount, id: string) =>
  (await mount.exists(noteFolderPath(id))) ? (await mount.readText(noteFolderPath(id))) || undefined : undefined;

const noteTitle = (rawTitle: string) => {
  const title = rawTitle.trim();
  if (!title) throw new Error("A note title is required.");
  return title;
};

export const noteExists = (mount: NotesMount, id: string) => mount.exists(notePath(id));
const readNoteDocument = async (mount: NotesMount, id: string) => {
  const document = parseNoteDocument(await mount.readText(notePath(id)));
  // Existing sidecar titles move into front matter on the next save or rename.
  if (document.title === undefined && (await mount.exists(titlePath(id)))) {
    document.title = await mount.readText(titlePath(id));
  }
  return document;
};
export const readNote = async (mount: NotesMount, id: string) => (await readNoteDocument(mount, id)).body;
export const readNoteTitle = async (mount: NotesMount, id: string) =>
  (await readNoteDocument(mount, id)).title || "New note";

const saveNoteDocument = async (mount: NotesMount, id: string, body: string, title: string, fields: string) => {
  await mount.updateText(notePath(id), buildNoteDocument(body, title, fields));
  if (await mount.exists(titlePath(id))) await mount.delete(titlePath(id));
};

export const writeNote = (mount: NotesMount, id: string, content: string) =>
  writeResourceInOrder(id, async () => {
    const document = await readNoteDocument(mount, id);
    const title = document.title || firstNoteTitle(content);
    await saveNoteDocument(mount, id, content, title, document.fields);
  });
export const deleteNote = (mount: NotesMount, id: string) => writeResourceInOrder(id, () => mount.delete(id));

export const renameNote = async (mount: NotesMount, id: string, rawTitle: string) =>
  writeResourceInOrder(id, async () => {
    const title = noteTitle(rawTitle);
    const document = await readNoteDocument(mount, id);
    await saveNoteDocument(mount, id, document.body, title, document.fields);
    return { id, title };
  });

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
  const sorted = notes
    .filter((note) => note !== undefined)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
  if (!(await mount.exists(noteOrderPath))) return sorted;
  const order: string[] = JSON.parse(await mount.readText(noteOrderPath));
  const positions = new Map(order.map((id, index) => [id, index]));
  return sorted.sort((a, b) => (positions.get(a.id) ?? order.length) - (positions.get(b.id) ?? order.length));
};

export const createNote = async (mount: NotesMount, rawTitle?: string) => {
  // An empty title permits exactly one automatic rename on the first nonempty save.
  const title = rawTitle === undefined ? "" : noteTitle(rawTitle);
  const id = crypto.randomUUID();
  await mount.writeText(notePath(id), buildNoteDocument("", title));
  return { id, title: title || "New note" };
};
