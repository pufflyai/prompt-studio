import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ExtensionIgnoreMatcher = {
  ignores: (pathInsideExtension: string) => boolean;
};

type IgnoreRule = {
  anchored: boolean;
  directoryOnly: boolean;
  hasSlash: boolean;
  negated: boolean;
  pattern: string;
  regex: RegExp;
};

const normalizeRelativePath = (path: string) =>
  path
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

const escapeRegex = (value: string) => value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");

const globToRegExp = (pattern: string) => {
  let source = "";

  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === "*" && next === "*") {
      source += ".*";
      index++;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += escapeRegex(char);
    }
  }

  return new RegExp(`^${source}$`);
};

const readGitignoreRules = (extensionRoot: string): IgnoreRule[] => {
  const gitignorePath = join(extensionRoot, ".gitignore");
  if (!existsSync(gitignorePath)) return [];

  return readFileSync(gitignorePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const negated = line.startsWith("!");
      const withoutNegation = negated ? line.slice(1) : line;
      const anchored = withoutNegation.startsWith("/");
      const directoryOnly = withoutNegation.endsWith("/");
      const pattern = normalizeRelativePath(withoutNegation);

      return {
        anchored,
        directoryOnly,
        hasSlash: pattern.includes("/"),
        negated,
        pattern,
        regex: globToRegExp(pattern),
      };
    })
    .filter((rule) => rule.pattern.length > 0);
};

const pathContainsDirectory = (path: string, directoryPattern: RegExp) =>
  path.split("/").some((segment) => directoryPattern.test(segment));

const devOnlyDirectories = new Set(["node_modules", "__tests__", "__fixtures__", "mocks"]);
const devOnlySourcePattern = /\.(?:spec|test|fixture)\.[cm]?[jt]sx?$/;
const testHelperPattern = /\.test-helpers\.[cm]?[jt]sx?$/;

const isDevOnlyPath = (path: string) => {
  const segments = path.split("/");
  if (segments.some((segment) => devOnlyDirectories.has(segment))) return true;

  const fileName = segments.at(-1) ?? "";
  return devOnlySourcePattern.test(fileName) || testHelperPattern.test(fileName) || fileName.endsWith(".d.ts");
};

const matchesRule = (rule: IgnoreRule, path: string) => {
  if (rule.directoryOnly) {
    if (!rule.hasSlash && !rule.anchored) return pathContainsDirectory(path, rule.regex);

    return rule.regex.test(path) || path.startsWith(`${rule.pattern}/`);
  }

  if (rule.hasSlash || rule.anchored) return rule.regex.test(path);

  return path.split("/").some((segment) => rule.regex.test(segment));
};

export const createExtensionIgnoreMatcher = (
  extensionRoot: string,
  options: { ignoreGit?: boolean } = {},
): ExtensionIgnoreMatcher => {
  const rules = readGitignoreRules(extensionRoot);
  const ignoreGit = options.ignoreGit ?? true;

  return {
    ignores(pathInsideExtension: string) {
      const path = normalizeRelativePath(pathInsideExtension);
      if (!path) return false;
      if (isDevOnlyPath(path)) return true;
      if (ignoreGit && (path === ".git" || path.startsWith(".git/"))) return true;

      let ignored = false;
      for (const rule of rules) {
        if (matchesRule(rule, path)) ignored = !rule.negated;
      }

      return ignored;
    },
  };
};
