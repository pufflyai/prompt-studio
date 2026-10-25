import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { createExtensionIgnoreMatcher } from "../extension-ignore";

const packageSchema = z.strictObject({
  version: z.literal(1),
  files: z.array(z.strictObject({ path: z.string().min(1), bytes: z.string(), executable: z.boolean() })),
});
export const extensionPackageMediaType = "application/vnd.pstdio.extension+json";

// Credentials, checkout metadata and machine-specific dependencies stay local.
const privatePath = (path: string) =>
  path
    .split("/")
    .some(
      (part) =>
        [".git", "node_modules", ".pstdio", ".npmrc", ".netrc", ".yarnrc", ".yarnrc.yml"].includes(part) ||
        /^\.env($|\.)/.test(part),
    );

export const packExtension = async (root: string) => {
  const files: { path: string; bytes: string; executable: boolean }[] = [];
  const matcher = createExtensionIgnoreMatcher(root);
  const collect = async (directory: string) => {
    const entries = await readdir(join(root, directory), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : Number(a.name > b.name)))) {
      const path = directory ? `${directory}/${entry.name}` : entry.name;
      if (privatePath(path) || matcher.ignores(path)) continue;
      if (entry.isSymbolicLink()) throw new Error(`Published packages cannot contain a symbolic link: ${path}`);
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile())
        files.push({
          path,
          bytes: (await readFile(join(root, path))).toString("base64"),
          executable: ((await stat(join(root, path))).mode & 0o111) !== 0,
        });
      else throw new Error(`Unsupported package file: ${path}`);
    }
  };
  await collect("");
  return new Blob([JSON.stringify({ version: 1, files })], { type: extensionPackageMediaType });
};

export const unpackExtension = async (source: Blob, root: string) => {
  const { files } = packageSchema.parse(JSON.parse(await source.text()));
  const paths = new Set<string>();
  for (const { path, bytes } of files) {
    if (
      /[\\:]/.test(path) ||
      path.includes(String.fromCharCode(0)) ||
      path.split("/").some((part) => !part || part === "." || part === "..") ||
      privatePath(path) ||
      paths.has(path) ||
      Buffer.from(bytes, "base64").toString("base64") !== bytes
    )
      throw new Error(`Invalid package path or bytes: ${path}`);
    paths.add(path);
  }
  for (const { path } of files) {
    const parts = path.split("/");
    while (parts.pop() && parts.length) {
      if (paths.has(parts.join("/"))) throw new Error(`Package path is both a directory and a file: ${path}`);
    }
  }
  // The caller owns a fresh staging directory, separate from the active installation.
  await mkdir(root, { recursive: true });
  for (const { path, bytes, executable } of files) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(bytes, "base64"), { flag: "wx", mode: executable ? 0o755 : 0o644 });
  }
};

// Windows does not retain POSIX executable bits. Compare the portable file data
// there, while preserving executable-bit edits on hosts that support them.
export const packageFilesMatch = async (left: Blob, right: Blob, platform = process.platform) => {
  const files = async (bytes: Blob) =>
    packageSchema
      .parse(JSON.parse(await bytes.text()))
      .files.map((file) => ({ ...file, executable: platform === "win32" ? false : file.executable }))
      .sort((a, b) => (a.path < b.path ? -1 : Number(a.path > b.path)));
  return JSON.stringify(await files(left)) === JSON.stringify(await files(right));
};
