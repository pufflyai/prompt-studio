import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";
import { parseExtensionApiDeclaration } from "pstdio-api-contracts/extension-kernel";
import { extensionStorageDirectory } from "../artifacts/extension-storage-path";
import { createExtensionIgnoreMatcher } from "../authoring/extension-ignore";
import { createPackageArchive } from "./package-archive";

export const packageSha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const MAX_EXTENSION_PACKAGE_BYTES = 64 * 1024 * 1024;
const segment = /^[a-z][a-z0-9-]*$/;
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const safePath = (path: string) =>
  path.length > 0 &&
  !path.includes("\\") &&
  !path.includes(":") &&
  !path.split("/").some((part) => !part || part === "." || part === "..");

export const packageMetadata = (raw: Record<string, unknown>) => {
  const { name, publisher, version, main } = raw;
  const engines = raw.engines as { pstdio?: unknown } | undefined;
  if (
    typeof name !== "string" ||
    !segment.test(name) ||
    typeof publisher !== "string" ||
    !segment.test(publisher) ||
    typeof version !== "string" ||
    !stableVersion.test(version) ||
    typeof main !== "string" ||
    !safePath(main.replace(/^\.\//, "")) ||
    typeof engines?.pstdio !== "string" ||
    !parseExtensionApiDeclaration(engines.pstdio)
  ) {
    throw new Error("Invalid extension package identity, version, entry point or engines.pstdio");
  }
  return { id: `${publisher}.${name}`, name, publisher, version, main, enginesPstdio: engines.pstdio };
};

export const readExtensionPackage = async (bytes: Uint8Array) => {
  if (bytes.byteLength > MAX_EXTENSION_PACKAGE_BYTES) throw new Error("Extension package is too large");
  const tar = gunzipSync(bytes, { maxOutputLength: 128 * 1024 * 1024 });
  const entries = await new Bun.Archive(tar).files();
  const files = new Map<string, File>();
  for (const [entry, file] of entries) {
    if (!safePath(entry)) throw new Error(`Unsafe extension package path: ${entry}`);
    files.set(entry, file);
  }
  const raw = JSON.parse((await files.get("package.json")?.text()) ?? "null");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Package is missing package.json");
  const manifest = packageMetadata(raw);
  if (!files.has(manifest.main.replace(/^\.\//, ""))) throw new Error("Package is missing its entry point");
  return { manifest, files };
};

export interface PackageIdentity {
  id: string;
  version: string;
  sha256: string;
}

export const unpackExtension = async (bytes: Uint8Array, target: string, expected?: PackageIdentity) => {
  if (expected && packageSha256(bytes) !== expected.sha256) throw new Error("Extension package SHA-256 mismatch");
  const contents = await readExtensionPackage(bytes);
  if (expected && (contents.manifest.id !== expected.id || contents.manifest.version !== expected.version)) {
    throw new Error("Extension package identity does not match its release");
  }
  // Writing only inspected regular files prevents archive links from escaping the staging directory.
  for (const [path, file] of contents.files) {
    const destination = join(target, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, new Uint8Array(await file.arrayBuffer()));
  }
  return contents.manifest;
};

export const packExtension = async (root: string) => {
  const raw = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const manifest = packageMetadata(raw);
  const includes = Array.isArray(raw.files) ? (raw.files as string[]) : null;
  const ignore = createExtensionIgnoreMatcher(root);
  const files: Record<string, Uint8Array> = {};
  const visit = async (dir: string) => {
    for (const entry of (await readdir(join(root, dir), { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.name === ".git" || entry.name === "node_modules" || path.endsWith(".tgz") || ignore.ignores(path))
        continue;
      if ((await lstat(join(root, path))).isSymbolicLink())
        throw new Error(`Package cannot include a symlink: ${path}`);
      if (entry.isDirectory()) await visit(path);
      else if (
        entry.isFile() &&
        (path === "package.json" ||
          !includes ||
          includes.some(
            (pattern) => path === pattern || path.startsWith(`${pattern}/`) || new Bun.Glob(pattern).match(path),
          ))
      ) {
        files[path] = new Uint8Array(await readFile(join(root, path)));
      }
    }
  };
  await visit("");
  const bytes = await createPackageArchive(files);
  await readExtensionPackage(bytes);
  return {
    bytes,
    manifest,
    sha256: packageSha256(bytes),
    filename: `${extensionStorageDirectory(manifest.id)}-${manifest.version}.tgz`,
  };
};
