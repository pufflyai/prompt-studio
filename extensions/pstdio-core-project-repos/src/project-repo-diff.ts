import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { ExtensionProcessApi, ExtensionReposApi, ProcessRunResult, RepoContext } from "@pstdio/sdk/extensions";

type ProjectRepoFileChange = "added" | "deleted" | "modified" | "renamed" | "copied" | "permissionChange";

interface ProjectRepoChangedFile {
  change: ProjectRepoFileChange;
  oldPath?: string;
  newPath?: string;
}

export interface ProjectRepoDiffFile {
  repoId: string;
  repoLabel: string;
  filePath: string;
  change: ProjectRepoFileChange;
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
  oldPath: string;
  newPath: string;
}

interface ReadProjectRepoDiffInput {
  process: Pick<ExtensionProcessApi, "run">;
  readFile?: (path: string) => Promise<string>;
  repos: Pick<ExtensionReposApi, "list">;
}

const trimEndLine = (value: string) => value.replace(/\n$/, "");

const lineCount = (content: string) => {
  if (!content) return 0;
  const lines = content.split("\n");
  return content.endsWith("\n") ? lines.length - 1 : lines.length;
};

const runGit = async (
  process: Pick<ExtensionProcessApi, "run">,
  repoPath: string,
  args: string[],
): Promise<ProcessRunResult> => {
  const result = await process.run({ command: ["git", ...args], cwd: repoPath });
  if (result.exitCode !== 0) throw new Error(trimEndLine(result.stderr) || `git ${args.join(" ")} failed`);
  return result;
};

const repoLabel = (repo: RepoContext) => basename(repo.path) || repo.repoId;

const prefixPath = (repo: RepoContext, relativePath: string) => `${repoLabel(repo)}/${relativePath}`;

const toChange = (status: string): ProjectRepoFileChange => {
  if (status.startsWith("A")) return "added";
  if (status.startsWith("D")) return "deleted";
  if (status.startsWith("R")) return "renamed";
  if (status.startsWith("C")) return "copied";
  if (status.startsWith("T")) return "permissionChange";
  return "modified";
};

const parseNameStatus = (value: string): ProjectRepoChangedFile[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status = "", firstPath = "", secondPath] = line.split("\t");
      const change = toChange(status);
      const newPath = secondPath ?? firstPath;
      return { change, oldPath: firstPath, newPath };
    });

const readChangedFiles = async (input: { process: Pick<ExtensionProcessApi, "run">; repo: RepoContext }) => {
  const tracked = parseNameStatus(
    (await runGit(input.process, input.repo.path, ["diff", "--name-status", "HEAD"])).stdout,
  );
  const untracked = (
    await runGit(input.process, input.repo.path, ["ls-files", "--others", "--exclude-standard"])
  ).stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((path) => ({ change: "added" as const, oldPath: path, newPath: path }));

  return [...tracked, ...untracked];
};

const readStats = async (input: {
  file: ProjectRepoChangedFile;
  process: Pick<ExtensionProcessApi, "run">;
  repo: RepoContext;
}) => {
  const path = input.file.newPath ?? input.file.oldPath ?? "";
  const result = await runGit(input.process, input.repo.path, ["diff", "--numstat", "HEAD", "--", path]);
  const [additions = "0", deletions = "0"] = result.stdout.split("\t");

  return {
    additions: Number.parseInt(additions, 10) || 0,
    deletions: Number.parseInt(deletions, 10) || 0,
  };
};

const readHeadFile = async (input: { path: string; process: Pick<ExtensionProcessApi, "run">; repo: RepoContext }) =>
  (await runGit(input.process, input.repo.path, ["show", `HEAD:${input.path}`])).stdout;

const readWorkingFile = async (input: {
  path: string;
  readFile: (path: string) => Promise<string>;
  repo: RepoContext;
}) => input.readFile(join(input.repo.path, input.path));

const readDiffFile = async (input: {
  file: ProjectRepoChangedFile;
  process: Pick<ExtensionProcessApi, "run">;
  readFile: (path: string) => Promise<string>;
  repo: RepoContext;
}): Promise<ProjectRepoDiffFile> => {
  const { file, process, readFile, repo } = input;
  const oldRelativePath = file.oldPath ?? file.newPath ?? "";
  const newRelativePath = file.newPath ?? file.oldPath ?? "";
  const relativePath = newRelativePath || oldRelativePath;
  const oldContent = file.change === "added" ? "" : await readHeadFile({ path: oldRelativePath, process, repo });
  const newContent = file.change === "deleted" ? "" : await readWorkingFile({ path: newRelativePath, readFile, repo });
  const stats =
    file.change === "added" && oldContent === ""
      ? { additions: lineCount(newContent), deletions: 0 }
      : await readStats({ file, process, repo });

  return {
    repoId: repo.repoId,
    repoLabel: repoLabel(repo),
    filePath: prefixPath(repo, relativePath),
    oldPath: prefixPath(repo, oldRelativePath),
    newPath: prefixPath(repo, newRelativePath),
    change: file.change,
    additions: stats.additions,
    deletions: stats.deletions,
    oldContent,
    newContent,
  };
};

export const readProjectRepoDiff = async (input: ReadProjectRepoDiffInput) => {
  const readTextFile = input.readFile ?? ((path: string) => readFile(path, "utf8"));
  const repos = await input.repos.list();
  const files: ProjectRepoDiffFile[] = [];

  for (const repo of repos) {
    const changedFiles = await readChangedFiles({ process: input.process, repo });
    for (const file of changedFiles) {
      files.push(await readDiffFile({ file, process: input.process, readFile: readTextFile, repo }));
    }
  }

  const totals = files.reduce(
    (total, file) => ({
      additions: total.additions + file.additions,
      deletions: total.deletions + file.deletions,
      fileCount: total.fileCount + 1,
    }),
    { additions: 0, deletions: 0, fileCount: 0 },
  );

  return {
    changedFilePaths: files.map((file) => file.newPath ?? file.oldPath ?? file.filePath),
    files,
    totals,
  };
};
