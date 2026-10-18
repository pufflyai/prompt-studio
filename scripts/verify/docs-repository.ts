/**
 * What the documentation checks know about the repository: which files other checkouts receive,
 * which Markdown files are checked, which skill folders are exported, and which pages the website publishes.
 */
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

/** The website's allow-list of published folders. The landing page owns it; this check only reads the data. */
export const DOCS_TOPICS_FILE = "clients/landing-page/src/content/docs-topics.json";

/**
 * Contributor and planning material. Public pages and exported skills must not link to it: their readers do
 * not have the repository, and PRDs or architecture notes do not say what a released version supports.
 */
export const PRIVATE_DOC_FOLDERS = [
  "documentation/guides/development",
  "documentation/lessons-learned",
  "documentation/references/architecture",
  "documentation/requirements",
];

/**
 * Folders the website must never publish. ADRs are not published either, but a public page may cite one
 * on GitHub to explain a decision or a temporary limitation.
 */
export const UNPUBLISHED_DOC_FOLDERS = [...PRIVATE_DOC_FOLDERS, "documentation/adrs"];

const isInside = (folders: string[], repoFile: string) =>
  folders.some((folder) => repoFile === folder || repoFile.startsWith(`${folder}/`));

export const isPrivateDoc = (repoFile: string) => isInside(PRIVATE_DOC_FOLDERS, repoFile);

export const isUnpublishedDoc = (repoFile: string) => isInside(UNPUBLISHED_DOC_FOLDERS, repoFile);

/** Website docs links: the path below the site and the anchor. */
export const SITE_DOCS_URL = /^https?:\/\/(?:www\.)?prompt\.studio(\/docs(?:\/[^#?]*)?)(?:\?[^#]*)?(?:#(.*))?$/;

/** Links to a file or folder of this repository on `main`: the path and the anchor. */
export const REPOSITORY_MAIN_URL =
  /^https?:\/\/github\.com\/pufflyai\/prompt-studio\/(?:blob|tree)\/main\/([^#?]*)(?:\?[^#]*)?(?:#(.*))?$/;

export interface DocsTopic {
  section: string;
  label: string;
  path: string;
  pages: string;
  overview?: string;
}

export interface RepositoryIndex {
  root: string;
  /** Files that every checkout has: tracked or new files that Git does not ignore. */
  files: Set<string>;
  /** Files that are symbolic links. Skill export skips them. */
  symlinks: Set<string>;
  directories: Set<string>;
}

export const indexRepository = (root: string): RepositoryIndex => {
  const result = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`git ls-files failed in ${root}:\n${result.stderr}`);

  const files = new Set<string>();
  const symlinks = new Set<string>();
  const directories = new Set<string>();
  for (const file of result.stdout.split("\0").filter(Boolean)) {
    let stat: ReturnType<typeof lstatSync>;
    try {
      stat = lstatSync(join(root, file));
    } catch {
      continue; // Deleted in the working tree but not yet staged.
    }
    files.add(file);
    if (stat.isSymbolicLink()) symlinks.add(file);
    for (let dir = posix.dirname(file); dir !== "."; dir = posix.dirname(dir)) directories.add(dir);
  }
  return { root, files, symlinks, directories };
};

const CHECKED_MARKDOWN = /^(documentation\/.*|extensions\/[^/]+\/(docs|skills)\/.*|(.*\/)?README)\.md$/;

/** Documentation, every README, extension docs, and every Markdown file in a skill. */
export const checkedMarkdownFiles = (repo: RepositoryIndex) =>
  [...repo.files].filter((file) => CHECKED_MARKDOWN.test(file) && !repo.symlinks.has(file)).sort();

/** Skill folders that extensions ship: `extensions/<extension>/skills/<skill>/` with a SKILL.md. */
export const skillFolders = (repo: RepositoryIndex) =>
  [...repo.files]
    .filter((file) => /^extensions\/[^/]+\/skills\/[^/]+\/SKILL\.md$/.test(file))
    .map((file) => posix.dirname(file))
    .sort();

/**
 * Files an agent receives when the skill is installed. The extension source is a sparse Git checkout,
 * and the installer copies every regular file below the skill folder as UTF-8 text.
 */
export const exportedSkillFiles = (repo: RepositoryIndex, folder: string) =>
  [...repo.files].filter((file) => file.startsWith(`${folder}/`) && !repo.symlinks.has(file)).sort();

export const readDocsTopics = (root: string) =>
  JSON.parse(readFileSync(join(root, DOCS_TOPICS_FILE), "utf8")) as DocsTopic[];

const NUMBERED_PAGE = /^(.+)\/\d{4}-(.+)\.md$/;

// Mirrors `publishedDocPath` in the landing page: an overview is served at the topic path, and a numbered
// page at the topic path plus its file name without the number.
export const publishedDocPath = (topics: DocsTopic[], repoFile: string) => {
  const numbered = repoFile.match(NUMBERED_PAGE);
  for (const topic of topics) {
    if (repoFile === topic.overview) return topic.path;
    if (numbered?.[1] === topic.pages) return `${topic.path}${numbered[2]}/`;
  }
  return undefined;
};

/** Website docs routes and the repository file behind each one. `/docs/` itself is the docs home. */
export const publishedRoutes = (topics: DocsTopic[], repo: RepositoryIndex) => {
  const routes = new Map<string, string | undefined>([["/docs/", undefined]]);
  for (const file of repo.files) {
    const path = publishedDocPath(topics, file);
    if (path) routes.set(path, file);
  }
  return routes;
};
