import docsTopics from "./docs-topics.json";

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

/**
 * The only repo docs the website publishes, in sidebar order. A folder that is not
 * listed here stays in the repo, so a new internal folder is private until added.
 * The list is JSON so that repository checks can read it without importing website code.
 */
export const DOCS_TOPICS = docsTopics as DocsTopic[];

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
