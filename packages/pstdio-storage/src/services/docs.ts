import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import type { createReposService } from "pstdio-db";

type DocsErrorCode = "DOCS_CONFIG_NOT_FOUND" | "DOCS_CONFIG_INVALID" | "DOCS_LINK_INVALID" | "DOCS_DOCUMENT_NOT_FOUND";

type DocsSidebarItem = {
  text: string;
  link?: string;
  items?: DocsSidebarItem[];
};

const DOCS_CONFIG_NAME = "navigation.json";
const DOCS_DIR = join(".pstdio", "docs");

const createDocsError = (code: DocsErrorCode, message: string) => Object.assign(new Error(message), { code });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertDocsRelativePath = (docsRoot: string, inputPath: string, source: string) => {
  const normalized = inputPath.replaceAll("\\", "/").trim();
  if (!normalized) {
    throw createDocsError("DOCS_LINK_INVALID", `Invalid docs path from ${source}: '${inputPath}'.`);
  }

  if (normalized.startsWith("/") || normalized === ".." || normalized.includes("../")) {
    throw createDocsError("DOCS_LINK_INVALID", `Docs path resolves outside .pstdio/docs: ${inputPath}`);
  }

  const resolved = resolve(docsRoot, normalized);
  const rel = relative(docsRoot, resolved);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw createDocsError("DOCS_LINK_INVALID", `Docs path resolves outside .pstdio/docs: ${inputPath}`);
  }

  return rel.replaceAll("\\", "/");
};

const normalizeSidebarLinkPath = (docsRoot: string, link: string) => {
  const withoutParams = link.split("?")[0]?.split("#")[0] ?? "";
  const trimmed = withoutParams.trim();

  if (!trimmed || /^[a-zA-Z]+:\/\//.test(trimmed)) {
    throw createDocsError("DOCS_LINK_INVALID", `Unsupported docs link: ${link}`);
  }

  const normalized = trimmed.replace(/^\/+/, "");
  const withExtension = normalized.endsWith(".md") ? normalized : `${normalized}.md`;
  return assertDocsRelativePath(docsRoot, withExtension, `docs link '${link}'`);
};

const parseSidebarItem = (value: unknown, location: string): DocsSidebarItem => {
  if (!isRecord(value)) {
    throw createDocsError("DOCS_CONFIG_INVALID", `Invalid sidebar item at ${location}.`);
  }

  const text = typeof value.text === "string" ? value.text.trim() : "";
  const link = typeof value.link === "string" ? value.link.trim() : undefined;
  const items = Array.isArray(value.items)
    ? value.items.map((item, index) => parseSidebarItem(item, `${location}.items[${index}]`))
    : undefined;

  if (!text) {
    throw createDocsError("DOCS_CONFIG_INVALID", `Sidebar item at ${location} is missing a valid text field.`);
  }

  if (!link && (!items || items.length === 0)) {
    throw createDocsError("DOCS_CONFIG_INVALID", `Sidebar item at ${location} must include link or items.`);
  }

  if (link === "") {
    throw createDocsError("DOCS_CONFIG_INVALID", `Sidebar item at ${location} has an empty link.`);
  }

  return { text, link, items };
};

const parseSidebar = (parsed: unknown) => {
  if (!isRecord(parsed)) {
    throw createDocsError("DOCS_CONFIG_INVALID", "navigation.json must contain an object.");
  }

  if (!Array.isArray(parsed.sidebar)) {
    throw createDocsError("DOCS_CONFIG_INVALID", "navigation.json must include a sidebar array.");
  }

  return parsed.sidebar.map((item, index) => parseSidebarItem(item, `sidebar[${index}]`));
};

const collectSidebarLinks = (items: DocsSidebarItem[]): string[] => {
  const links: string[] = [];
  for (const item of items) {
    if (item.link) {
      links.push(item.link);
    }
    if (item.items?.length) {
      links.push(...collectSidebarLinks(item.items));
    }
  }
  return links;
};

const listRelativeFiles = (rootDir: string, currentDir = rootDir): string[] => {
  if (!existsSync(currentDir)) {
    return [];
  }

  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRelativeFiles(rootDir, absolutePath));
      continue;
    }

    if (entry.isSymbolicLink()) {
      throw createDocsError("DOCS_LINK_INVALID", `Symlinks are not supported in .pstdio/docs: ${absolutePath}`);
    }

    if (!entry.isFile()) {
      continue;
    }

    files.push(relative(rootDir, absolutePath).replaceAll("\\", "/"));
  }

  return files.sort((left, right) => left.localeCompare(right));
};

const parseConfigAndValidateLinks = (docsRoot: string, configText: string, availableFiles: Set<string>) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(configText);
  } catch {
    throw createDocsError("DOCS_CONFIG_INVALID", "Unable to parse .pstdio/docs/navigation.json");
  }

  const sidebar = parseSidebar(parsed);
  const links = collectSidebarLinks(sidebar);
  for (const link of links) {
    const fromLink = normalizeSidebarLinkPath(docsRoot, link);
    if (!availableFiles.has(fromLink)) {
      throw createDocsError("DOCS_DOCUMENT_NOT_FOUND", `Docs link not found in .pstdio/docs: ${link}`);
    }
  }

  return { sidebar };
};

export const isDocsServiceError = (value: unknown): value is Error & { code: DocsErrorCode } =>
  value instanceof Error && "code" in value && typeof value.code === "string";

export const createDocsService = (reposService: ReturnType<typeof createReposService>) => {
  const resolveDocsDir = async (projectId: string) => {
    const repos = await reposService.listByProject(projectId);
    if (repos.length === 0) {
      throw createDocsError("DOCS_CONFIG_NOT_FOUND", `No repo linked to project ${projectId}.`);
    }
    return join(repos[0].path, DOCS_DIR);
  };

  const getIndex = async (projectId: string) => {
    const docsDir = await resolveDocsDir(projectId);
    const configPath = join(docsDir, DOCS_CONFIG_NAME);

    if (!existsSync(configPath)) {
      throw createDocsError("DOCS_CONFIG_NOT_FOUND", "Docs config not found at .pstdio/docs/navigation.json");
    }

    const configText = readFileSync(configPath, "utf8");
    const availableFiles = new Set(listRelativeFiles(docsDir));
    return parseConfigAndValidateLinks(docsDir, configText, availableFiles);
  };

  const getDocument = async (projectId: string, link: string) => {
    const docsDir = await resolveDocsDir(projectId);
    const relativePath = normalizeSidebarLinkPath(docsDir, link);
    const filePath = join(docsDir, relativePath);

    if (!existsSync(filePath) || extname(relativePath).toLowerCase() !== ".md") {
      throw createDocsError("DOCS_DOCUMENT_NOT_FOUND", `Docs markdown file not found: ${relativePath}`);
    }

    return {
      link,
      path: relativePath,
      content: readFileSync(filePath, "utf8"),
    };
  };

  return { getIndex, getDocument };
};
