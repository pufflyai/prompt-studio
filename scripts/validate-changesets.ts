import { readdir } from "node:fs/promises";
import { join } from "node:path";

const changesetDirectory = ".changeset";
const frontmatterEntryPattern = /^"[^"]+": (patch|minor|major)$/;

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

const readGitStdout = async (command: string[]) => {
  const proc = Bun.spawn(command, {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "ignore",
  });

  const output = proc.stdout ? await new Response(proc.stdout).text() : "";
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    return null;
  }

  return output.trim();
};

const parseStatusPath = (line: string) => {
  const statusAndPath = line.slice(3);
  const renameParts = statusAndPath.split(" -> ");
  return (renameParts.at(-1) ?? statusAndPath).trim();
};

const readChangedFiles = async () => {
  const files = new Set<string>();

  const statusOutput = await readGitStdout(["git", "status", "--porcelain"]);
  if (statusOutput) {
    for (const line of statusOutput.split("\n")) {
      if (!line.trim()) {
        continue;
      }

      files.add(parseStatusPath(line));
    }
  }

  const baseRef = await readGitStdout(["git", "merge-base", "HEAD", "origin/main"]);

  if (baseRef) {
    const committedDiff = await readGitStdout(["git", "diff", "--name-only", `${baseRef}...HEAD`]);
    if (committedDiff) {
      for (const path of committedDiff.split("\n")) {
        if (path.trim()) {
          files.add(path.trim());
        }
      }
    }
  }

  return [...files].sort();
};

const parseReleasedPackages = (content: string) => {
  const normalizedContent = content.replaceAll("\r\n", "\n");
  const lines = normalizedContent.split("\n");
  const closingDelimiterIndex = lines.indexOf("---", 1);
  if (closingDelimiterIndex === -1) {
    return [];
  }

  return lines
    .slice(1, closingDelimiterIndex)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.match(/^"([^"]+)": (patch|minor|major)$/)?.[1])
    .filter((pkg): pkg is string => Boolean(pkg));
};

const isSdkRuntimeChange = (path: string) => {
  if (!path.startsWith("packages/sdk/")) {
    return false;
  }

  if (path.endsWith(".md")) {
    return false;
  }

  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(path) || path.includes("/__tests__/")) {
    return false;
  }

  return path.startsWith("packages/sdk/src/") || path === "packages/sdk/package.json";
};

export const collectChangesetValidationIssues = async (
  changesetFiles?: Record<string, string>,
  changedFiles?: string[],
) => {
  const files = changesetFiles ?? (await readChangesetFiles());
  const changed = changedFiles ?? (await readChangedFiles());

  const issues = Object.entries(files)
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .flatMap(([filePath, content]) => validateChangesetFile(filePath, content));

  const changedSdkFiles = changed.filter((path) => isSdkRuntimeChange(path));
  if (changedSdkFiles.length === 0) {
    return issues;
  }

  const releasedPackages = new Set(
    Object.values(files)
      .flatMap((content) => parseReleasedPackages(content))
      .sort(),
  );

  if (!releasedPackages.has("@pstdio/sdk")) {
    return [
      ...issues,
      {
        filePath: changesetDirectory,
        message: "changes to packages/sdk/** require an @pstdio/sdk changeset entry",
      },
    ];
  }

  return issues;
};

const main = async () => {
  const issues = await collectChangesetValidationIssues();

  if (issues.length > 0) {
    console.error("Invalid changeset frontmatter:");
    for (const issue of issues) {
      console.error(`- ${issue.filePath}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log("Changeset frontmatter is valid.");
};

if (import.meta.main) {
  await main();
}
