import type { ArtifactMount } from "@pstdio/sdk/extensions";

/** Notes are plain Markdown files in the repo, so an id is also a file name. */
export type NotesMount = Pick<ArtifactMount, "exists" | "list" | "readText" | "writeText" | "updateText" | "delete">;

const SUFFIX = ".md";

const notePath = (id: string) => `${id}${SUFFIX}`;

const noteId = (title: string) => {
  const slug = title
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return slug || "note";
};

const titleOf = (id: string, content: string) => {
  const heading = content.split("\n").find((line) => line.trim().length > 0);
  return heading?.replace(/^#+\s*/, "").trim() || id;
};

export const noteExists = (mount: NotesMount, id: string) => mount.exists(notePath(id));

export const readNote = (mount: NotesMount, id: string) => mount.readText(notePath(id));

export const writeNote = (mount: NotesMount, id: string, content: string) => mount.updateText(notePath(id), content);

export const deleteNote = (mount: NotesMount, id: string) => mount.delete(notePath(id));

export const listNotes = async (mount: NotesMount) => {
  const files = await mount.list(`*${SUFFIX}`);
  const notes = await Promise.all(
    files.map(async (file) => {
      const id = file.path.slice(0, -SUFFIX.length);
      return { id, title: titleOf(id, await mount.readText(file.path)), updatedAt: file.updatedAt ?? "" };
    }),
  );
  return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
};

export const createNote = async (mount: NotesMount, rawTitle: string) => {
  const title = rawTitle.trim();
  const base = noteId(title);
  const taken = new Set((await listNotes(mount)).map((note) => note.id));

  let id = base;
  for (let suffix = 2; taken.has(id); suffix += 1) id = `${base}-${suffix}`;

  await mount.writeText(notePath(id), `# ${title}\n\n`);
  return { id, title };
};
