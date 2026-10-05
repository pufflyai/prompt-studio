export type DocsSection = "Guides" | "References" | "Extensions";

export interface DocsTopic {
  section: DocsSection;
  label: string;
  /** Site path of the topic. Its pages live one level below. */
  path: string;
  /** Repo folder whose numbered markdown files are the topic's pages, in file-number order. */
  pages: string;
  /** Repo file published at the topic path itself, before the numbered pages. */
  overview?: string;
}

const extension = (label: string, slug: string, folder: string): DocsTopic => ({
  section: "Extensions",
  label,
  path: `/docs/extensions/${slug}/`,
  pages: `extensions/${folder}/docs`,
  overview: `extensions/${folder}/README.md`,
});

/**
 * The only repo docs the website publishes, in sidebar order. A folder that is not
 * listed here stays in the repo, so a new internal folder is private until added.
 */
export const DOCS_TOPICS: DocsTopic[] = [
  {
    section: "Guides",
    label: "Getting started",
    path: "/docs/guides/getting-started/",
    pages: "documentation/guides/getting-started",
  },
  {
    section: "Guides",
    label: "How Prompt Studio works",
    path: "/docs/guides/concepts/",
    pages: "documentation/guides/concepts",
  },
  {
    section: "Guides",
    label: "Build extensions",
    path: "/docs/guides/extensions/",
    pages: "documentation/guides/extensions",
  },
  { section: "Guides", label: "Use the SDK", path: "/docs/guides/sdk/", pages: "documentation/guides/sdk" },
  { section: "References", label: "CLI", path: "/docs/references/cli/", pages: "documentation/references/cli" },
  {
    section: "References",
    label: "Extension API",
    path: "/docs/references/extensions/",
    pages: "documentation/references/extensions",
  },
  { section: "References", label: "SDK", path: "/docs/references/sdk/", pages: "documentation/references/sdk" },
  {
    section: "References",
    label: "Workbench",
    path: "/docs/references/workbench/",
    pages: "documentation/references/workbench",
  },
  extension("Planner", "planner", "pstdio-planner"),
  extension("Notes", "notes", "pstdio-notes"),
  extension("Reports", "reports", "pstdio-reports"),
  extension("Artifacts", "artifacts", "pstdio-artifacts"),
  extension("Remote Workspaces", "remote-workspaces", "remote-workspaces"),
  extension("Claude Code", "claude-code", "harness-claude-code"),
  extension("Codex", "codex", "harness-codex"),
  extension("OpenCode", "opencode", "harness-open-code"),
  extension("Extension Lab", "extension-lab", "extension-lab"),
];

export const DOCS_SECTIONS: DocsSection[] = ["Guides", "References", "Extensions"];

/** Glob patterns, relative to the repo root, for every published docs file. */
export const DOCS_PATTERNS = DOCS_TOPICS.flatMap((topic) => [
  ...(topic.overview ? [topic.overview] : []),
  `${topic.pages}/[0-9][0-9][0-9][0-9]-*.md`,
]);

const NUMBERED_PAGE = /^(.+)\/\d{4}-(.+)\.md$/;

/** Site path of a repo file, or undefined when the website does not publish it. */
export const publishedDocPath = (repoFile: string) => {
  const numbered = repoFile.match(NUMBERED_PAGE);
  for (const topic of DOCS_TOPICS) {
    if (repoFile === topic.overview) return topic.path;
    if (numbered?.[1] === topic.pages) return `${topic.path}${numbered[2]}/`;
  }
  return undefined;
};

export const docsTopicForPath = (path: string) => DOCS_TOPICS.find((topic) => path.startsWith(topic.path));
