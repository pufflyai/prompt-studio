import type { MarkdownInstance } from "astro";
import type { LegalDocuments } from "../content/landing-content";

// Build time only: Astro compiles the markdown, and the pages hand the HTML to the
// workbench as props, so no markdown parser ships to the browser.
const modules = import.meta.glob<MarkdownInstance<Record<string, never>>>("../content/legal/*.md", { eager: true });

export const loadLegalDocuments = async () => {
  const entries = await Promise.all(
    Object.entries(modules).map(async ([path, module]) => [
      path.replace(/^.*\/(.+)\.md$/, "$1"),
      await module.compiledContent(),
    ]),
  );
  return Object.fromEntries(entries) as LegalDocuments;
};
