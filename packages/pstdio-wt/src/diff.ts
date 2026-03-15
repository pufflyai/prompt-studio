import { git } from "./git";

type FileChange = "added" | "deleted" | "modified" | "renamed" | "copied" | "permissionChange";

export type FileDiff = {
  filePath: string;
  change: FileChange;
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
  oldPath?: string;
  newPath?: string;
};

export type WorktreeDiff = {
  files: FileDiff[];
  totals: {
    additions: number;
    deletions: number;
    file_count: number;
  };
};

const STATUS_TO_CHANGE: Record<string, FileChange> = {
  A: "added",
  D: "deleted",
  M: "modified",
  T: "permissionChange",
};

const parseStatusLine = (line: string) => {
  const status = line.slice(0, 1);
  const rest = line.slice(1).trim();

  // Renames/copies: R100\told\tnew
  if (status === "R" || status === "C") {
    const similarity = line.slice(1).match(/^\d+/)?.[0] ?? "";
    const pathPart = rest.slice(similarity.length).trim();
    const paths = pathPart.split("\t");
    return {
      change: (status === "R" ? "renamed" : "copied") as FileChange,
      oldPath: paths[0],
      newPath: paths[1],
      filePath: paths[1],
    };
  }

  return {
    change: STATUS_TO_CHANGE[status] ?? "modified",
    filePath: rest,
  };
};

const getFileContent = async (cwd: string, ref: string, filePath: string) => {
  try {
    // Use Bun.spawn directly to avoid trim() from git() helper
    const proc = Bun.spawn(["git", "show", `${ref}:${filePath}`], { cwd, stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) return "";
    return stdout;
  } catch {
    return "";
  }
};

const getWorkingContent = async (cwd: string, filePath: string) => {
  try {
    const file = Bun.file(`${cwd}/${filePath}`);
    return await file.text();
  } catch {
    return "";
  }
};

const countAdditionsDeletions = async (cwd: string, base: string, filePath: string, oldPath?: string) => {
  try {
    const numstat = await git(cwd, ["diff", "--numstat", base, "--", oldPath ?? filePath, filePath]);
    const firstLine = numstat.split("\n")[0] ?? "";
    const [addStr, delStr] = firstLine.split("\t");
    return {
      additions: addStr === "-" ? 0 : Number.parseInt(addStr, 10) || 0,
      deletions: delStr === "-" ? 0 : Number.parseInt(delStr, 10) || 0,
    };
  } catch {
    return { additions: 0, deletions: 0 };
  }
};

const countContentLines = (content: string) => {
  if (!content) return 0;

  const lines = content.split("\n");
  return content.endsWith("\n") ? lines.length - 1 : lines.length;
};

export const getWorktreeDiff = async (opts: { worktreePath: string; base: string }): Promise<WorktreeDiff> => {
  const { worktreePath, base } = opts;

  // Stage everything temporarily to capture all changes (committed + staged + unstaged)
  // We compare HEAD against the base to get committed changes,
  // and also check working tree for uncommitted changes.

  // Get committed changes relative to base
  const committedRaw = await git(worktreePath, ["diff", "--name-status", base, "HEAD"]).catch(() => "");

  // Get uncommitted changes (staged + unstaged) relative to HEAD
  const uncommittedRaw = await git(worktreePath, ["diff", "--name-status", "HEAD"]).catch(() => "");

  // Get untracked files
  const untrackedRaw = await git(worktreePath, ["ls-files", "--others", "--exclude-standard"]).catch(() => "");

  // Build a map of all changed files, preferring the most recent state
  const fileMap = new Map<string, ReturnType<typeof parseStatusLine>>();

  for (const line of committedRaw.split("\n").filter(Boolean)) {
    const parsed = parseStatusLine(line);
    fileMap.set(parsed.filePath, parsed);
  }

  for (const line of uncommittedRaw.split("\n").filter(Boolean)) {
    const parsed = parseStatusLine(line);
    fileMap.set(parsed.filePath, parsed);
  }

  for (const filePath of untrackedRaw.split("\n").filter(Boolean)) {
    fileMap.set(filePath, { change: "added", filePath });
  }

  // Build full diff with content for each file
  const files: FileDiff[] = [];

  for (const entry of fileMap.values()) {
    const oldPath = entry.oldPath ?? entry.filePath;
    const newPath = entry.newPath ?? entry.filePath;

    const oldContent = entry.change === "added" ? "" : await getFileContent(worktreePath, base, oldPath);

    let newContent: string;
    if (entry.change === "deleted") {
      newContent = "";
    } else {
      // Try working tree first, fall back to HEAD
      newContent = await getWorkingContent(worktreePath, newPath);
    }

    // Get line stats from the full diff (base to working tree)
    const stats = await countAdditionsDeletions(worktreePath, base, newPath, entry.oldPath);
    const additions =
      entry.change === "added" && stats.additions === 0 ? countContentLines(newContent) : stats.additions;
    const deletions =
      entry.change === "deleted" && stats.deletions === 0 ? countContentLines(oldContent) : stats.deletions;

    files.push({
      filePath: newPath,
      change: entry.change,
      additions,
      deletions,
      oldContent,
      newContent,
      ...(entry.oldPath ? { oldPath: entry.oldPath } : {}),
      ...(entry.newPath ? { newPath: entry.newPath } : {}),
    });
  }

  const totals = files.reduce(
    (acc, f) => ({
      additions: acc.additions + f.additions,
      deletions: acc.deletions + f.deletions,
      file_count: acc.file_count + 1,
    }),
    { additions: 0, deletions: 0, file_count: 0 },
  );

  return { files, totals };
};
