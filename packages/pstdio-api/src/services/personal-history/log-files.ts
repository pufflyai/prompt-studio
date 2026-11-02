import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createLineReader } from "./log-entries";

export const historyNamespace = (input: { managerOrigin: string; accountId: string; projectId: string }) =>
  createHash("sha256")
    .update(JSON.stringify([input.managerOrigin, input.accountId, input.projectId]))
    .digest("hex")
    .slice(0, 32);

type Published = { updatedAt: string | null; fingerprints: string[]; head?: number };

const readJson = async <T>(path: string, fallback: T) => {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
};
const writeJson = async (path: string, value: unknown) => {
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, path);
};

/** Each received page and its cursor commit together by atomic rename. No transcript lives in a sync cache. */
export const createSessionLogFiles = (root: string) => {
  const folder = (namespace: string) => join(root, "personal-history", namespace);
  const path = (namespace: string, sessionId: string, kind: string) =>
    join(folder(namespace), `${encodeURIComponent(sessionId)}.${kind}`);
  const pages = async (namespace: string, id: string) => {
    try {
      return (await readdir(path(namespace, id, "pages"))).filter((name) => /^\d{16}\.json$/.test(name)).sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  };
  const savePage = async (namespace: string, id: string, after: number, lines: string[]) => {
    const directory = path(namespace, id, "pages");
    await mkdir(directory, { recursive: true });
    await writeJson(join(directory, `${String(after).padStart(16, "0")}.json`), lines);
  };
  return {
    savePage,
    append: (namespace: string, sessionId: string, lines: string[]) => savePage(namespace, sessionId, 0, lines),
    async read(namespace: string, sessionId: string) {
      const messages = new Map<
        string,
        { index: number; message: NonNullable<ReturnType<ReturnType<typeof createLineReader>>>["message"] }
      >();
      const read = createLineReader();
      for (const page of await pages(namespace, sessionId)) {
        const lines = await readJson<string[]>(join(path(namespace, sessionId, "pages"), page), []);
        for (const line of lines) {
          const entry = read(line);
          if (entry) messages.set(entry.message.id, entry);
        }
      }
      return [...messages.values()].sort((a, b) => a.index - b.index).map(({ message }) => message);
    },
    async readPosition(namespace: string, sessionId: string) {
      const last = (await pages(namespace, sessionId)).at(-1);
      return { after: last ? Number(last.slice(0, 16)) : 0 };
    },
    readPublished: (namespace: string, sessionId: string) =>
      readJson<Published>(path(namespace, sessionId, "published.json"), { updatedAt: null, fingerprints: [] }),
    async writePublished(namespace: string, sessionId: string, published: Published) {
      await mkdir(folder(namespace), { recursive: true });
      await writeJson(path(namespace, sessionId, "published.json"), published);
    },
  };
};
export type SessionLogFiles = ReturnType<typeof createSessionLogFiles>;
