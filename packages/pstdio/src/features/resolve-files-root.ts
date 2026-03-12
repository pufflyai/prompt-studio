import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { isCompiledBinary } from "../adapters/cli/commands/serve/embedded-assets";

// Embedded file names are relative to the manifest at packages/pstdio/src/
const FILES_PREFIX = "../files/";

let cachedRoot: string | null = null;

const extractEmbeddedFiles = async () => {
  const root = join(tmpdir(), "pstdio-files");
  if (existsSync(join(root, "docs"))) return root;

  const files = Bun.embeddedFiles as (Blob & { name: string })[];

  for (const file of files) {
    if (!file.name.startsWith(FILES_PREFIX)) continue;

    const relativePath = file.name.slice(FILES_PREFIX.length);
    const outPath = join(root, relativePath);
    mkdirSync(dirname(outPath), { recursive: true });
    await Bun.write(outPath, file);
  }

  return root;
};

export const resolveFilesRoot = async () => {
  if (cachedRoot) return cachedRoot;

  if (isCompiledBinary()) {
    cachedRoot = await extractEmbeddedFiles();
  } else {
    cachedRoot = join(import.meta.dirname, "../../files");
  }

  return cachedRoot;
};
