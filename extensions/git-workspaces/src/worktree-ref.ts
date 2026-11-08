import { isAbsolute, normalize, relative, resolve, sep } from "node:path";
import type { ArtifactMount, ExtensionContextBase, WorkspaceProviderRef } from "@pstdio/sdk/extensions";
import { git } from "./git";

export const readGitRef = (ref: WorkspaceProviderRef) => {
  const { sourceRoot, worktreeRoot, relativePath } = ref.data;
  if (
    ref.version !== 1 ||
    typeof sourceRoot !== "string" ||
    typeof worktreeRoot !== "string" ||
    typeof relativePath !== "string" ||
    !isAbsolute(sourceRoot) ||
    !isAbsolute(worktreeRoot)
  )
    throw new Error("The workspace has no valid Git backing reference.");
  const rootPath = resolve(worktreeRoot, relativePath);
  const rel = relative(worktreeRoot, rootPath);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    throw new Error("The project folder is outside its owned directory.");
  return { sourceRoot, worktreeRoot, relativePath, rootPath };
};
export const ownedDirectory = async (ctx: ExtensionContextBase, ref: WorkspaceProviderRef) => {
  if (!ctx.localDirectory) throw new Error("This host cannot allocate provider directories.");
  const directory = await ctx.localDirectory();
  const paths = readGitRef(ref);
  if (
    normalize(directory.path) !== normalize(paths.worktreeRoot) ||
    normalize(paths.sourceRoot) === normalize(directory.path)
  )
    throw new Error("The Git backing reference does not match its owned directory.");
  return { ...paths, directory };
};
export const registeredWorktrees = async (ctx: ExtensionContextBase, sourceRoot: string) => {
  const output = await git(ctx, ["worktree", "list", "--porcelain"], sourceRoot);
  return output.split("\n\n").flatMap((block) => {
    const lines = block.split("\n");
    const path = lines.find((line) => line.startsWith("worktree "))?.slice(9);
    const branch = lines.find((line) => line.startsWith("branch refs/heads/"))?.slice(18);
    return path ? [{ path: normalize(path), branch, prunable: lines.some((line) => line.startsWith("prunable")) }] : [];
  });
};
export const localResult = (ref: WorkspaceProviderRef, state: "provisioning" | "ready" | "failed" | "cancelled") => {
  const { rootPath } = readGitRef(ref);
  return {
    providerRef: ref,
    state,
    executionKind: "local" as const,
    executionTarget: { kind: "local" as const, rootPath, displayPath: rootPath },
    displayPath: rootPath,
    ...(typeof ref.data.branch === "string" ? { branch: ref.data.branch } : {}),
    capabilities: { files: "write" as const, diff: true, merge: true, rebase: true, delete: true },
  };
};

export const readyResult = async (ref: WorkspaceProviderRef, files: ArtifactMount) => {
  // The mount resolves symlinks inside the owned directory. Check after checkout
  // hooks, and on every reopen, before granting the project an execution root.
  const { relativePath } = readGitRef(ref);
  if (!(await files.exists(relativePath))) throw new Error("The workspace project folder is missing.");
  await files.listDirs(relativePath);
  // A prepared base is an unfinished checkout intent. Drop it once Git has
  // registered the checkout so recovery never recreates a lost ready workspace.
  const { base: _base, ...data } = ref.data;
  return localResult({ ...ref, data }, "ready");
};
