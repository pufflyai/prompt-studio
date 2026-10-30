import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { indexCanvasFile } from "./index-canvas-file";
import type { CanvasEntry } from "./manifest";

const CANVAS_FILE = /\.canvas\.[jt]sx$/;
const SKIPPED_FOLDERS = new Set(["node_modules", "dist", ".pstdio", ".git"]);
const toPosix = (path: string) => path.split(sep).join("/");

const listWithGit = (root: string) => {
  const result = Bun.spawnSync(
    ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "*.canvas.tsx", "*.canvas.jsx"],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) return;
  // `--cached` still lists files deleted from the working tree but not from the index.
  return result.stdout
    .toString()
    .split("\0")
    .filter((path) => path && existsSync(join(root, path)));
};

// Skipped folders are never entered: polling must not walk installed packages or build output.
const scan = async (root: string, folder = ""): Promise<string[]> => {
  const files: string[] = [];
  for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
    const path = folder ? `${folder}/${entry.name}` : entry.name;
    if (entry.isDirectory() && !SKIPPED_FOLDERS.has(entry.name)) files.push(...(await scan(root, path)));
    else if (entry.isFile() && CANVAS_FILE.test(entry.name)) files.push(path);
  }
  return files;
};

/** Canvas files relative to the project root. Git-ignored files are skipped. */
export const listCanvasFiles = async (root: string) =>
  (listWithGit(root) ?? (await scan(root))).filter((path) => CANVAS_FILE.test(path)).sort();

/** The nearest `.canvas/preview.tsx` at or above the file's folder, relative to the project root. */
export const createPreviewFinder = (root: string) => {
  const folders = new Map<string, string | undefined>();
  const find = (folder: string): string | undefined => {
    if (folders.has(folder)) return folders.get(folder);
    const candidate = join(folder, ".canvas", "preview.tsx");
    const parent = dirname(folder);
    let found: string | undefined;
    if (existsSync(candidate)) found = toPosix(relative(root, candidate));
    else if (folder !== root && parent !== folder) found = find(parent);
    folders.set(folder, found);
    return found;
  };
  return (file: string) => find(dirname(resolve(root, file)));
};

export const discoverCanvases = async (root: string): Promise<CanvasEntry[]> => {
  const findPreview = createPreviewFinder(root);
  return Promise.all(
    (await listCanvasFiles(root)).map(async (id) => ({
      id,
      ...indexCanvasFile(id, await readFile(join(root, id), "utf8")),
      preview: findPreview(id),
    })),
  );
};
