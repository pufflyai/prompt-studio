import { getImagePreviewMimeType, isImagePreviewPath } from "pstdio-file-types";
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

export type FileDiffSummary = Omit<FileDiff, "oldContent" | "newContent">;

export type WorktreeDiffSummaryFiles = {
  files: FileDiffSummary[];
  totals: WorktreeDiff["totals"];
};

export type DiffSummary = {
  additions: number;
  deletions: number;
  file_count: number;
};

const STATUS_TO_CHANGE: Record<string, FileChange> = {
  A: "added",
  D: "deleted",
  M: "modified",
  T: "permissionChange",
};

type ParsedEntry = { change: FileChange; filePath: string; oldPath?: string; newPath?: string };

const parseStatusLine = (line: string): ParsedEntry => {
  const status = line.slice(0, 1);
  const rest = line.slice(1).trim();

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

  return { change: STATUS_TO_CHANGE[status] ?? "modified", filePath: rest };
};

// Discover all changed files: committed + uncommitted + untracked
const discoverChangedFiles = async (worktreePath: string, base: string) => {
  const committedRaw = await git(worktreePath, ["diff", "--name-status", base, "HEAD"]).catch(() => "");
  const uncommittedRaw = await git(worktreePath, ["diff", "--name-status", "HEAD"]).catch(() => "");
  const untrackedRaw = await git(worktreePath, ["ls-files", "--others", "--exclude-standard"]).catch(() => "");

  const fileMap = new Map<string, ParsedEntry>();

  for (const line of committedRaw.split("\n").filter(Boolean)) {
    const parsed = parseStatusLine(line);
    fileMap.set(parsed.filePath, parsed);
  }
  for (const line of uncommittedRaw.split("\n").filter(Boolean)) {
    const parsed = parseStatusLine(line);
    fileMap.set(parsed.filePath, parsed);
  }

  const untrackedPaths = untrackedRaw.split("\n").filter(Boolean);
  for (const filePath of untrackedPaths) {
    fileMap.set(filePath, { change: "added", filePath });
  }

  const untrackedSet = new Set(untrackedPaths);
  return { fileMap, untrackedPaths, untrackedSet };
};

const countContentLines = (content: string) => {
  if (!content) return 0;
  const lines = content.split("\n");
  return content.endsWith("\n") ? lines.length - 1 : lines.length;
};

const countUntrackedLines = async (worktreePath: string, paths: string[]) => {
  const counts = await Promise.all(
    paths.map(async (filePath) => {
      try {
        const content = await Bun.file(`${worktreePath}/${filePath}`).text();
        return countContentLines(content);
      } catch {
        return 0;
      }
    }),
  );
  return counts.reduce((sum, c) => sum + c, 0);
};

export const MAX_IMAGE_PREVIEW_BYTES = 1_000_000;

const toImageDataUrl = (filePath: string, bytes: Uint8Array) => {
  const mimeType = getImagePreviewMimeType(filePath);
  if (!mimeType) return null;
  if (bytes.byteLength > MAX_IMAGE_PREVIEW_BYTES) return null;

  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
};

const getGitObjectSize = async (cwd: string, ref: string, filePath: string) => {
  const rawSize = await git(cwd, ["cat-file", "-s", `${ref}:${filePath}`]);
  return Number.parseInt(rawSize.trim(), 10) || 0;
};

const getFileContent = async (cwd: string, ref: string, filePath: string) => {
  try {
    const isImage = isImagePreviewPath(filePath);
    if (isImage && (await getGitObjectSize(cwd, ref, filePath)) > MAX_IMAGE_PREVIEW_BYTES) return "";

    const proc = Bun.spawn(["git", "show", `${ref}:${filePath}`], { cwd, stdout: "pipe", stderr: "pipe" });
    const bytes = new Uint8Array(await new Response(proc.stdout).arrayBuffer());
    const exitCode = await proc.exited;
    if (exitCode !== 0) return "";
    return toImageDataUrl(filePath, bytes) ?? new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
};

const getWorkingContent = async (cwd: string, filePath: string) => {
  try {
    const file = Bun.file(`${cwd}/${filePath}`);
    if (isImagePreviewPath(filePath)) {
      if (file.size > MAX_IMAGE_PREVIEW_BYTES) return "";
      return toImageDataUrl(filePath, new Uint8Array(await file.arrayBuffer())) ?? "";
    }

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

const getDiffStatsByPath = async (cwd: string, base: string) => {
  const raw = await git(cwd, ["diff", "--numstat", base, "--"]).catch(() => "");
  const stats = new Map<string, { additions: number; deletions: number }>();

  for (const line of raw.split("\n").filter(Boolean)) {
    const [additions, deletions, filePath] = line.split("\t");
    if (!filePath) continue;
    stats.set(filePath, {
      additions: additions === "-" ? 0 : Number.parseInt(additions, 10) || 0,
      deletions: deletions === "-" ? 0 : Number.parseInt(deletions, 10) || 0,
    });
  }

  return stats;
};

const buildFileDiffSummary = async (
  worktreePath: string,
  base: string,
  entry: ParsedEntry,
  statsByPath?: ReadonlyMap<string, { additions: number; deletions: number }>,
): Promise<FileDiffSummary> => {
  const oldPath = entry.oldPath ?? entry.filePath;
  const newPath = entry.newPath ?? entry.filePath;
  const cachedStats = entry.oldPath ? undefined : statsByPath?.get(entry.filePath);
  const stats = cachedStats ?? (await countAdditionsDeletions(worktreePath, base, newPath, entry.oldPath));
  const additions =
    entry.change === "added" && stats.additions === 0
      ? countContentLines(await getWorkingContent(worktreePath, newPath))
      : stats.additions;
  const deletions =
    entry.change === "deleted" && stats.deletions === 0
      ? countContentLines(await getFileContent(worktreePath, base, oldPath))
      : stats.deletions;

  return {
    filePath: newPath,
    change: entry.change,
    additions,
    deletions,
    ...(entry.oldPath ? { oldPath: entry.oldPath } : {}),
    ...(entry.newPath ? { newPath: entry.newPath } : {}),
  };
};

const buildTotals = (files: Array<Pick<FileDiff, "additions" | "deletions">>) =>
  files.reduce<WorktreeDiff["totals"]>(
    (acc, f) => ({
      additions: acc.additions + f.additions,
      deletions: acc.deletions + f.deletions,
      file_count: acc.file_count + 1,
    }),
    { additions: 0, deletions: 0, file_count: 0 },
  );

export const getWorktreeDiffSummary = async (opts: { worktreePath: string; base: string }): Promise<DiffSummary> => {
  const { worktreePath, base } = opts;
  const { fileMap, untrackedPaths, untrackedSet } = await discoverChangedFiles(worktreePath, base);

  const file_count = fileMap.size;
  if (file_count === 0) return { additions: 0, deletions: 0, file_count: 0 };

  // Numstat for tracked files (committed + uncommitted, not untracked)
  const trackedPaths = [...fileMap.keys()].filter((p) => !untrackedSet.has(p));
  let additions = 0;
  let deletions = 0;

  if (trackedPaths.length > 0) {
    const numstatRaw = await git(worktreePath, ["diff", "--numstat", base, "--", ...trackedPaths]).catch(() => "");
    for (const line of numstatRaw.split("\n").filter(Boolean)) {
      const [addStr, delStr] = line.split("\t");
      if (addStr !== "-") additions += Number.parseInt(addStr, 10) || 0;
      if (delStr !== "-") deletions += Number.parseInt(delStr, 10) || 0;
    }
  }

  // Count lines in untracked files (same as full diff)
  additions += await countUntrackedLines(worktreePath, untrackedPaths);

  return { additions, deletions, file_count };
};

export const getWorktreeDiffSummaryFiles = async (opts: {
  worktreePath: string;
  base: string;
}): Promise<WorktreeDiffSummaryFiles> => {
  const { worktreePath, base } = opts;
  const { fileMap } = await discoverChangedFiles(worktreePath, base);
  const statsByPath = await getDiffStatsByPath(worktreePath, base);
  const files = await Promise.all(
    [...fileMap.values()].map((entry) => buildFileDiffSummary(worktreePath, base, entry, statsByPath)),
  );

  return { files, totals: buildTotals(files) };
};

export const getWorktreeDiffFile = async (opts: {
  worktreePath: string;
  base: string;
  filePath: string;
}): Promise<FileDiff | null> => {
  const { worktreePath, base, filePath } = opts;
  const { fileMap } = await discoverChangedFiles(worktreePath, base);
  const entry = fileMap.get(filePath);

  if (!entry) return null;

  const oldPath = entry.oldPath ?? entry.filePath;
  const newPath = entry.newPath ?? entry.filePath;
  const oldContent = entry.change === "added" ? "" : await getFileContent(worktreePath, base, oldPath);
  const newContent = entry.change === "deleted" ? "" : await getWorkingContent(worktreePath, newPath);
  const stats = await buildFileDiffSummary(worktreePath, base, entry);

  return {
    ...stats,
    oldContent,
    newContent,
  };
};

export const getWorktreeDiff = async (opts: { worktreePath: string; base: string }): Promise<WorktreeDiff> => {
  const { worktreePath, base } = opts;
  const { fileMap } = await discoverChangedFiles(worktreePath, base);

  const files: FileDiff[] = [];

  for (const entry of fileMap.values()) {
    const oldPath = entry.oldPath ?? entry.filePath;
    const newPath = entry.newPath ?? entry.filePath;

    const oldContent = entry.change === "added" ? "" : await getFileContent(worktreePath, base, oldPath);

    let newContent: string;
    if (entry.change === "deleted") {
      newContent = "";
    } else {
      newContent = await getWorkingContent(worktreePath, newPath);
    }

    const stats = await buildFileDiffSummary(worktreePath, base, entry);

    files.push({
      ...stats,
      oldContent,
      newContent,
    });
  }

  return { files, totals: buildTotals(files) };
};
