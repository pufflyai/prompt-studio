import type { MarkdownInstance } from "astro";
import { DOCUMENT_VIEWS, type LegalDocuments } from "../content/landing-content";

// Build time only: Astro compiles the markdown, and the pages hand the HTML to the
// workbench as props, so no markdown parser ships to the browser.
const modules = import.meta.glob<MarkdownInstance<Record<string, never>>>("../content/legal/*.md", { eager: true });

export const loadLegalDocuments = async () => {
  const compiled = new Map(
    await Promise.all(
      Object.entries(modules).map(
        async ([path, module]) => [path.replace(/^.*\/(.+)\.md$/, "$1"), await module.compiledContent()] as const,
      ),
    ),
  );

  // Every legal route needs its markdown, or the page would build with an empty document.
  const missing = DOCUMENT_VIEWS.filter((view) => !compiled.has(view));
  if (missing.length > 0) {
    throw new Error(`Missing legal markdown in src/content/legal: ${missing.map((view) => `${view}.md`).join(", ")}`);
  }

  return Object.fromEntries(DOCUMENT_VIEWS.map((view) => [view, compiled.get(view)])) as LegalDocuments;
};
