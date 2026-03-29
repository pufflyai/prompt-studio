import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { isCompiledBinary } from "../adapters/cli/commands/serve/embedded-assets";

// Embedded file names are relative to the manifest at packages/pstdio/src/
const FILES_PREFIX = "../files/";
type EmbeddedFile = Blob & { name: string };

const normalizeEmbeddedRelativePath = (relativePath: string) =>
  relativePath.endsWith(".") ? relativePath.slice(0, -1) : relativePath;

const listEmbeddedFiles = () =>
  (Bun.embeddedFiles as EmbeddedFile[]).filter((file) => file.name.startsWith(FILES_PREFIX));

const resolveEmbeddedOutputPath = (root: string, file: EmbeddedFile) =>
  join(root, normalizeEmbeddedRelativePath(file.name.slice(FILES_PREFIX.length)));

const hasCompleteEmbeddedFilesRoot = (root: string, files: EmbeddedFile[]) =>
  files.every((file) => existsSync(resolveEmbeddedOutputPath(root, file)));

const extractEmbeddedFiles = async () => {
  const root = join(tmpdir(), "pstdio-files");
  const files = listEmbeddedFiles();
  if (hasCompleteEmbeddedFilesRoot(root, files)) return root;

  rmSync(root, { recursive: true, force: true });

  for (const file of files) {
    const outPath = resolveEmbeddedOutputPath(root, file);
    mkdirSync(dirname(outPath), { recursive: true });
    await Bun.write(outPath, file);
  }

  return root;
};

export const resolveFilesRoot = async () => {
  if (isCompiledBinary()) {
    return extractEmbeddedFiles();
  }
  return join(import.meta.dirname, "../../files");
};
