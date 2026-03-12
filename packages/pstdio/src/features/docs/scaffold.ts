import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

import { resolveFilesRoot } from "../resolve-files-root";

const DOCS_DIR = join(".pstdio", "docs");

export const scaffoldDocs = async (root: string) => {
  const docsDir = join(root, DOCS_DIR);
  if (existsSync(docsDir)) return;

  const filesRoot = await resolveFilesRoot();
  cpSync(join(filesRoot, "docs"), docsDir, { recursive: true });
};
