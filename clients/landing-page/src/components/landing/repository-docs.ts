import { repositoryDocUrl, resolveRepositoryDocPathFromUrl } from "./repository-doc-route";

const DOCS_GLOB_PREFIX = "../../../../../.pstdio/docs/";
const GITHUB_SOURCE_PREFIX = "https://github.com/pufflyai/prompt-studio/blob/main/";

const rawDocumentModules = import.meta.glob<string>("../../../../../.pstdio/docs/**/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

export interface RepositoryDocument {
  markdown: string;
  path: string;
  title: string;
  url: string;
}

export interface RepositoryDocTreeNode {
  children?: RepositoryDocTreeNode[];
  id: string;
  label: string;
  path?: string;
}

const titleFromMarkdown = (markdown: string, path: string) => {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;

  const filename = path.split("/").at(-1)?.replace(/\.md$/, "") ?? path;
  return filename.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
};

export const REPOSITORY_DOCUMENTS: RepositoryDocument[] = Object.entries(rawDocumentModules)
  .map(([modulePath, markdown]) => {
    const path = modulePath.slice(modulePath.indexOf(DOCS_GLOB_PREFIX) + DOCS_GLOB_PREFIX.length);
    return {
      markdown,
      path,
      title: titleFromMarkdown(markdown, path),
      url: repositoryDocUrl(path),
    };
  })
  .sort((left, right) => left.path.localeCompare(right.path));

const documentsByPath = new Map(REPOSITORY_DOCUMENTS.map((document) => [document.path, document]));
const documentPaths = new Set(documentsByPath.keys());

interface MutableTreeNode extends RepositoryDocTreeNode {
  children: MutableTreeNode[];
  isFolder?: boolean;
}

const folderLabel = (segment: string) =>
  segment
    .replace(/[-_]+/g, " ")
    .replace(/\b(api|sdk|cli|adr)s?\b/gi, (value) => value.toUpperCase())
    .replace(/^\w/, (character) => character.toUpperCase());

const buildDocumentTree = () => {
  const root: MutableTreeNode = { id: "doc-folder:root", label: "Documentation", children: [], isFolder: true };

  for (const document of REPOSITORY_DOCUMENTS) {
    if (document.path === "index.md") continue;

    const segments = document.path.split("/");
    const filename = segments.pop();
    if (!filename) continue;

    let parent = root;
    let currentFolder = "";
    for (const segment of segments) {
      currentFolder = currentFolder ? `${currentFolder}/${segment}` : segment;
      let folder = parent.children.find((node) => node.id === `doc-folder:${currentFolder}`);
      if (!folder) {
        folder = {
          id: `doc-folder:${currentFolder}`,
          label: folderLabel(segment),
          children: [],
          isFolder: true,
        };
        parent.children.push(folder);
      }
      parent = folder;
    }

    parent.children.push({
      id: `doc:${document.path}`,
      label: filename === "index.md" ? "Overview" : document.title,
      path: document.path,
      children: [],
    });
  }

  const sortNodes = (nodes: MutableTreeNode[]) => {
    nodes.sort((left, right) => {
      if (left.label === "Overview") return -1;
      if (right.label === "Overview") return 1;
      if (left.isFolder !== right.isFolder) return left.isFolder ? -1 : 1;
      return left.label.localeCompare(right.label);
    });
    for (const node of nodes) sortNodes(node.children);
  };

  sortNodes(root.children);
  return root.children;
};

export const REPOSITORY_DOC_TREE = buildDocumentTree();

export const repositoryDocument = (path?: string) =>
  documentsByPath.get(path ?? "index.md") ?? documentsByPath.get("index.md");

const splitSource = (source: string) => {
  const match = source.match(/^([^?#]*)([?#].*)?$/);
  return { pathname: match?.[1] ?? source, suffix: match?.[2] ?? "" };
};

const resolveSegments = (base: string[], source: string[]) => {
  const resolved = [...base];
  for (const segment of source) {
    if (!segment || segment === ".") continue;
    if (segment === "..") resolved.pop();
    else resolved.push(segment);
  }
  return resolved;
};

const internalDocumentPath = (sourcePath: string, currentPath: string) => {
  const base = sourcePath.startsWith("/") ? [] : currentPath.split("/").slice(0, -1);
  const candidate = resolveSegments(base, sourcePath.replace(/^\//, "").split("/")).join("/");
  const candidates = [candidate, `${candidate}.md`, `${candidate}/index.md`];
  return candidates.find((path) => documentsByPath.has(path));
};

const repositorySourcePath = (sourcePath: string, currentPath: string) => {
  const base = [".pstdio", "docs", ...currentPath.split("/").slice(0, -1)];
  return resolveSegments(base, sourcePath.split("/")).join("/");
};

export const resolveRepositoryDocUrl = (source: string, currentPath: string, kind: "link" | "image") => {
  if (/^[a-z][a-z\d+.-]*:/i.test(source) || source.startsWith("#")) return source;

  const { pathname, suffix } = splitSource(source);
  const internalPath = internalDocumentPath(pathname, currentPath);
  if (internalPath) return `${repositoryDocUrl(internalPath)}${suffix}`;
  if (kind === "image") return null;
  if (source.startsWith("/")) return source;
  return `${GITHUB_SOURCE_PREFIX}${repositorySourcePath(pathname, currentPath)}${suffix}`;
};

export const repositoryDocPathFromUrl = (url: string) => {
  return resolveRepositoryDocPathFromUrl(url, documentPaths);
};

export const ALL_REPOSITORY_DOC_PATHS = REPOSITORY_DOCUMENTS.map((document) => document.url);
