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
  const heading = content.match(/^ {0,3}#{1,6}[\t ]+(.+)$/m);
  return heading?.[1].replace(/[\t ]+#+[\t ]*$/, "").trim() || id;
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
      try {
        return { id, title: titleOf(id, await mount.readText(file.path)), updatedAt: file.updatedAt ?? "" };
      } catch (error) {
        if (!(await mount.exists(file.path))) return undefined;
        throw error;
      }
    }),
  );
  return notes
    .filter((note) => note !== undefined)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
};

export const createNote = async (mount: NotesMount, rawTitle: string) => {
  const title = rawTitle.trim();
  // Identity is allocated independently of the directory, so concurrent creates cannot overwrite each other.
  const id = `${noteId(title)}-${crypto.randomUUID()}`;

  await mount.writeText(notePath(id), `# ${title}\n\n`);
  return { id, title };
};
