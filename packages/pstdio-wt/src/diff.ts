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

// List all files in a directory: tracked + untracked (excluding .git internals)
const listAllFiles = async (cwd: string) => {
  const tracked = await git(cwd, ["ls-files"]).catch(() => "");
  const untracked = await git(cwd, ["ls-files", "--others", "--exclude-standard"]).catch(() => "");
  const all = new Set<string>();
  for (const f of tracked.split("\n").filter(Boolean)) all.add(f);
  for (const f of untracked.split("\n").filter(Boolean)) all.add(f);
  return all;
};

const readFileFromDisk = async (dir: string, filePath: string) => {
  try {
    return await Bun.file(`${dir}/${filePath}`).text();
  } catch {
    return "";
  }
};

const countLines = (content: string) => {
  if (!content) return 0;
  return content.split("\n").filter(Boolean).length;
};

export const getDiffAgainstDirectory = async (opts: {
  worktreePath: string;
  referencePath: string;
  exclude?: string[];
}): Promise<WorktreeDiff> => {
  const { worktreePath, referencePath, exclude } = opts;

  const [wtFiles, refFiles] = await Promise.all([listAllFiles(worktreePath), listAllFiles(referencePath)]);

  const allPaths = new Set([...wtFiles, ...refFiles]);

  if (exclude) {
    for (const filePath of allPaths) {
      if (exclude.some((prefix) => filePath.startsWith(prefix))) {
        allPaths.delete(filePath);
      }
    }
  }
  const files: FileDiff[] = [];

  for (const filePath of allPaths) {
    const inWt = wtFiles.has(filePath);
    const inRef = refFiles.has(filePath);

    const [wtContent, refContent] = await Promise.all([
      inWt ? readFileFromDisk(worktreePath, filePath) : Promise.resolve(""),
      inRef ? readFileFromDisk(referencePath, filePath) : Promise.resolve(""),
    ]);

    if (wtContent === refContent) continue;

    let change: FileChange;
    if (!inRef) {
      change = "added";
    } else if (!inWt) {
      change = "deleted";
    } else {
      change = "modified";
    }

    const additions = change === "deleted" ? 0 : countLines(wtContent);
    const deletions = change === "added" ? 0 : countLines(refContent);

    files.push({
      filePath,
      change,
      additions,
      deletions,
      oldContent: refContent,
      newContent: wtContent,
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

    files.push({
      filePath: newPath,
      change: entry.change,
      additions: stats.additions,
      deletions: stats.deletions,
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
