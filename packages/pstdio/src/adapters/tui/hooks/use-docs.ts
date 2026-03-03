import { join } from "node:path";
import { useEffect, useState } from "react";

import { findGitRoot } from "@/features/config/config";
import { flattenSidebar, loadDocsConfig, loadDocument } from "@/features/docs/reader";
import type { DocRow, DocsConfig } from "@/features/docs/types";

export function useDocs() {
  const [config, setConfig] = useState<DocsConfig | null>(null);
  const [docsDir, setDocsDir] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const root = findGitRoot(process.cwd());
    if (!root) {
      setError("Not inside a git repository.");
      return;
    }

    const dir = join(root, ".pstdio", "docs");
    setDocsDir(dir);

    const loaded = loadDocsConfig(dir);
    if (!loaded) {
      setError("No navigation.json found. Run pstdio init first.");
      return;
    }

    setConfig(loaded);
    setError("");
  }, []);

  const getRows = (expanded: Set<string>): DocRow[] => {
    if (!config) return [];
    return flattenSidebar(config.sidebar, expanded);
  };

  const getDocument = (link: string) => {
    if (!docsDir) return null;
    return loadDocument(docsDir, link);
  };

  return { config, error, getRows, getDocument };
}
