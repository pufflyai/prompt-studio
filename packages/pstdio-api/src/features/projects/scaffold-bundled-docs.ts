import { join } from "node:path";
import { scaffoldBundledFiles } from "./scaffold-bundled-files";

const EMBEDDED_DOCS_PREFIX = "../files/documentation/";

export const scaffoldBundledDocs = async (repoPath: string, bundledDocsDir: string) =>
  scaffoldBundledFiles(join(repoPath, ".pstdio", "docs"), {
    bundledSourceDir: bundledDocsDir,
    embeddedPrefix: EMBEDDED_DOCS_PREFIX,
  });
