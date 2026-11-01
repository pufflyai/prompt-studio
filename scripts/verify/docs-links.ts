/**
 * Checks links in documentation, READMEs, extension docs, and exported skills without the network:
 *
 * - Relative links must reach a file that every checkout has, and a heading that the page has.
 * - Website docs links must reach a route the website publishes, and an existing heading.
 * - GitHub links to this repository's `main` branch must reach an existing path.
 * - Exported skills must work when copied alone: links stay in the skill folder and reach exported files.
 * - Public pages and skills must not link to private documentation, and the website must not publish it.
 * - ADR numbers must identify exactly one decision.
 *
 * External sites are checked on a schedule by docs-external-links.ts instead, so their availability
 * cannot fail unrelated pull requests.
 */
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { extractLinks, headingAnchors } from "./docs-markdown";
import {
  checkedMarkdownFiles,
  DOCS_TOPICS_FILE,
  type DocsTopic,
  exportedSkillFiles,
  indexRepository,
  isPrivateDoc,
  isUnpublishedDoc,
  publishedDocPath,
  publishedRoutes,
  REPOSITORY_MAIN_URL,
  type RepositoryIndex,
  readDocsTopics,
  SITE_DOCS_URL,
  skillFolders,
} from "./docs-repository";

export interface DocsProblem {
  file: string;
  line: number;
  message: string;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isUtf8Text = (bytes: Buffer) => {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
};

const checkAllowList = (topics: DocsTopic[]) =>
  topics
    .flatMap((topic) => [topic.pages, topic.overview ?? ""])
    .filter(isUnpublishedDoc)
    .map((folder) => ({
      file: DOCS_TOPICS_FILE,
      line: 1,
      message: `publishes "${folder}", which the website must not publish.`,
    }));

const checkAdrNumbers = (files: Set<string>) => {
  const owners = new Map<string, string>();
  const problems: DocsProblem[] = [];
  for (const file of [...files].sort()) {
    const number = file.match(/^documentation\/adrs\/(\d{4})-[^/]+\.md$/)?.[1];
    if (!number) continue;
    const owner = owners.get(number);
    if (owner) {
      problems.push({
        file,
        line: 1,
        message: `reuses ADR number ${number} from "${owner}". Use a new number.`,
      });
    } else {
      owners.set(number, file);
    }
  }
  return problems;
};

const checkSkillFiles = (root: string, folder: string, files: Set<string>) => {
  const problems: DocsProblem[] = [];
  if (!files.has(`${folder}/SKILL.md`)) problems.push({ file: folder, line: 1, message: "has no exported SKILL.md." });
  for (const file of files) {
    if (isUtf8Text(readFileSync(join(root, file)))) continue;
    problems.push({
      file,
      line: 1,
      message: "is not UTF-8 text. Skill files are exported as text, so this file would be corrupted.",
    });
  }
  return problems;
};

interface LinkSource {
  file: string;
  /** The skill folder when the file is part of an exported skill. */
  skill?: string;
  /** Website pages and skills reach readers who do not have the repository. */
  isPublic: boolean;
}

interface LinkContext {
  repo: RepositoryIndex;
  routes: Map<string, string | undefined>;
  exported: Map<string, Set<string>>;
  anchorsOf: (file: string) => Set<string>;
}

// Returns the problem with one link, if any.
const checkLink = (context: LinkContext, source: LinkSource, url: string) => {
  const { repo, routes, exported, anchorsOf } = context;
  const exists = (target: string) => repo.files.has(target) || repo.directories.has(target);
  const anchorProblem = (target: string | undefined, anchor: string | undefined) => {
    if (!target?.endsWith(".md") || !anchor || anchorsOf(target).has(decode(anchor))) return undefined;
    return `links to "${url}", but that page has no "${decode(anchor)}" heading.`;
  };
  const privateProblem = (target: string) =>
    source.isPublic && isPrivateDoc(target)
      ? `links to private documentation "${target}". Public pages and skills must not depend on it.`
      : undefined;

  const site = url.match(SITE_DOCS_URL);
  if (site) {
    const path = site[1]!.endsWith("/") ? site[1]! : `${site[1]}/`;
    if (!routes.has(path)) return `links to "${url}", which the website does not publish.`;
    return anchorProblem(routes.get(path), site[2]);
  }

  const github = url.match(REPOSITORY_MAIN_URL);
  if (github) {
    const target = decode(github[1]!).replace(/\/$/, "");
    if (!exists(target)) return `links to "${url}", which does not exist.`;
    return privateProblem(target) ?? anchorProblem(target, github[2]);
  }

  // Other sites are checked on a schedule. Root-relative paths are website paths, not repository files.
  if (SCHEME.test(url) || url.startsWith("/")) return undefined;

  const [path = "", anchor] = url.split("#", 2);
  const target =
    path === ""
      ? source.file
      : posix.normalize(posix.join(posix.dirname(source.file), decode(path))).replace(/\/$/, "");
  if (source.skill && !target.startsWith(`${source.skill}/`)) {
    return `links to "${url}", outside the skill folder. Exported skills contain only their own folder; use a https://prompt.studio/docs/ link.`;
  }
  if (source.skill && !exported.get(source.skill)!.has(target) && !repo.directories.has(target)) {
    return `links to "${url}", which the exported skill does not contain.`;
  }
  if (target.startsWith("../") || !exists(target)) return `links to "${url}", which does not exist.`;
  return privateProblem(target) ?? anchorProblem(target, anchor);
};

export const checkDocsLinks = (root: string) => {
  const repo = indexRepository(root);
  const topics = readDocsTopics(root);
  const skills = skillFolders(repo);
  const anchors = new Map<string, Set<string>>();
  const context: LinkContext = {
    repo,
    routes: publishedRoutes(topics, repo),
    exported: new Map(skills.map((folder) => [folder, new Set(exportedSkillFiles(repo, folder))])),
    anchorsOf: (file) => {
      if (!anchors.has(file)) anchors.set(file, headingAnchors(readFileSync(join(root, file), "utf8")));
      return anchors.get(file)!;
    },
  };

  const problems: DocsProblem[] = [
    ...checkAdrNumbers(repo.files),
    ...checkAllowList(topics),
    ...[...context.exported].flatMap(([folder, files]) => checkSkillFiles(root, folder, files)),
  ];
  for (const file of checkedMarkdownFiles(repo)) {
    const skill = skills.find((folder) => file.startsWith(`${folder}/`));
    const source = { file, skill, isPublic: skill !== undefined || publishedDocPath(topics, file) !== undefined };
    for (const { url, line } of extractLinks(readFileSync(join(root, file), "utf8"))) {
      const message = checkLink(context, source, url);
      if (message) problems.push({ file, line, message });
    }
  }
  return problems.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
};

if (import.meta.main) {
  const problems = checkDocsLinks(join(import.meta.dir, "../.."));
  for (const problem of problems) console.error(`${problem.file}:${problem.line} ${problem.message}`);
  if (problems.length > 0) {
    console.error(
      `\n${problems.length} documentation link problem(s). See documentation/guides/0001-documentation.md.`,
    );
    process.exit(1);
  }
  console.log("Documentation links, published routes, and exported skills are valid.");
}
