import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const DOCS_DIR = join(".pstdio", "docs");
const DOCS_TEMPLATE = join(import.meta.dirname, "../../../files/docs");

export const scaffoldDocs = (root: string) => {
  const docsDir = join(root, DOCS_DIR);
  if (existsSync(docsDir)) return;

  cpSync(DOCS_TEMPLATE, docsDir, { recursive: true });
};
