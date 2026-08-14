import { readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { read as readChangesetsConfig } from "@changesets/config";

const changesetDirectory = ".changeset";
const changesetConfigPath = join(changesetDirectory, "config.json");
const frontmatterEntryPattern = /^"[^"]+": (patch|minor|major)$/;

type RootManifest = {
  workspaces?: string[];
};

type WorkspaceManifest = {
  name?: string;
};

export type ChangesetValidationIssue = {
  filePath: string;
  message: string;
};

const validateChangesetFile = (filePath: string, content: string) => {
  const normalizedContent = content.replaceAll("\r\n", "\n");
  const lines = normalizedContent.split("\n");

  if (lines[0] !== "---") {
    return [
      {
        filePath,
        message: "missing opening frontmatter delimiter (`---`)",
      },
    ];
  }

  const closingDelimiterIndex = lines.indexOf("---", 1);
  if (closingDelimiterIndex === -1) {
    return [
      {
        filePath,
        message: "missing closing frontmatter delimiter (`---`)",
      },
    ];
  }

  const frontmatterLines = lines.slice(1, closingDelimiterIndex).filter((line) => line.trim().length > 0);
  if (frontmatterLines.length === 0) {
    return [
      {
        filePath,
        message: "frontmatter must contain at least one package release entry",
      },
    ];
  }

  for (const line of frontmatterLines) {
    if (!frontmatterEntryPattern.test(line)) {
      return [
        {
          filePath,
          message: `invalid frontmatter entry: ${line}`,
        },
      ];
    }
  }

  if (
    lines
      .slice(closingDelimiterIndex + 1)
      .join("\n")
      .trim().length === 0
  ) {
    return [
      {
        filePath,
        message: "changeset summary must not be empty",
      },
    ];
  }

  return [];
};

const readChangesetFiles = async () => {
  const entries = await readdir(changesetDirectory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(changesetDirectory, entry.name))
    .sort();

  const contents = await Promise.all(
    files.map(async (filePath) => [filePath, await Bun.file(filePath).text()] as const),
  );

  return Object.fromEntries(contents);
};

export const collectChangesetValidationIssues = async (changesetFiles?: Record<string, string>) => {
  const files = changesetFiles ?? (await readChangesetFiles());

  return Object.entries(files)
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .flatMap(([filePath, content]) => validateChangesetFile(filePath, content));
};

export const collectChangesetConfigIssues = async (cwd = process.cwd()) => {
  try {
    const config = await readChangesetsConfig(cwd);
    const rootManifest = (await Bun.file(join(cwd, "package.json")).json()) as RootManifest;
    const repoLocalWorkspaceNames = new Set<string>();

    for (const workspace of rootManifest.workspaces ?? []) {
      const manifests = new Bun.Glob(`${workspace.replace(/\/$/, "")}/package.json`);
      for await (const manifestPath of manifests.scan({ cwd, dot: true, onlyFiles: true })) {
        const manifestFullPath = resolve(cwd, manifestPath);
        const pathFromRoot = relative(cwd, manifestFullPath);
        if (pathFromRoot.split(sep)[0] !== ".pstdio") continue;

        const manifest = (await Bun.file(manifestFullPath).json()) as WorkspaceManifest;
        if (manifest.name) repoLocalWorkspaceNames.add(manifest.name);
      }
    }

    return [...repoLocalWorkspaceNames]
      .filter((name) => !config.ignore.includes(name))
      .sort()
      .map((name) => ({
        filePath: changesetConfigPath,
        message: `repo-local workspace "${name}" must be ignored`,
      }));
  } catch (error) {
    return [
      {
        filePath: changesetConfigPath,
        message: error instanceof Error ? error.message : "invalid changesets config",
      },
    ];
  }
};

const main = async () => {
  const issues = [...(await collectChangesetValidationIssues()), ...(await collectChangesetConfigIssues())];

  if (issues.length > 0) {
    console.error("Invalid changeset configuration:");
    for (const issue of issues) {
      console.error(`- ${issue.filePath}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log("Changeset configuration is valid.");
};

if (import.meta.main) {
  await main();
}
