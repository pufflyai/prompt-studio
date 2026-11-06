import { join } from "node:path";
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { BOOK_PATH, type Book, parseBook, serializeBook } from "./model";
import { digest } from "./records";

export const resolveWorkspace = async (ctx: ExtensionContextBase, id?: string, writable = false) => {
  const selected = id ?? (await ctx.settings.get("workspaceId"));
  const workspace = selected ? await ctx.workspaces.get(String(selected)) : await ctx.workspaces.getDefault();
  const root = workspace?.rootPath ?? workspace?.root_path;
  const state = workspace?.providerState ?? workspace?.provider_state;
  const kind = workspace?.executionKind ?? workspace?.execution_kind;
  const files = (workspace?.capabilities ?? workspace?.provider_capabilities_json)?.files;
  if (!workspace || !root || state !== "ready" || kind !== "local" || files === "none" || !files)
    throw new Error("Choose a ready local workspace with file access.");
  if (writable && files !== "write") throw new Error("This workspace is read-only.");
  return { workspace, root };
};
export const git = async (ctx: ExtensionContextBase, root: string, args: string[]) =>
  ctx.process.run({ command: ["git", ...args], cwd: root });
const requireGit = async (ctx: ExtensionContextBase, root: string, args: string[]) => {
  const result = await git(ctx, root, args);
  if (result.exitCode) throw new Error(result.stderr.trim() || "Git operation failed.");
  return result.stdout.trim();
};
export const safePath = (path: string) => {
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some((part) => part === ".." || part === ".git") ||
    /^[a-z]:/i.test(path)
  )
    throw new Error(`Choose a repository-relative source path: ${path}`);
  return path;
};
// Git's complete addition diff reads tracked and untracked working files without relying on shell commands.
export const readWorkingText = async (ctx: ExtensionContextBase, root: string, path: string) => {
  const result = await git(ctx, root, [
    "diff",
    "--no-index",
    "--text",
    "--no-ext-diff",
    "--",
    "/dev/null",
    safePath(path),
  ]);
  if (result.exitCode > 1) throw new Error(result.stderr.trim() || `Could not read ${path}`);
  if (!result.stdout) return null;
  const lines = result.stdout.split("\n");
  const start = lines.findIndex((line) => line.startsWith("@@"));
  if (start < 0) return null;
  const content = lines
    .slice(start + 1)
    .filter((line) => line.startsWith("+"))
    .map((line) => line.slice(1))
    .join("\n");
  return result.stdout.includes("\\ No newline at end of file") ? content : `${content}\n`;
};
export const readRepository = async (
  ctx: ExtensionContextBase,
  workspaceId?: string,
  revision: "working" | "accepted" = "working",
) => {
  const { workspace, root } = await resolveWorkspace(ctx, workspaceId);
  const branch = await requireGit(ctx, root, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const target = String((await ctx.settings.get("targetBranch")) ?? "main");
  if (
    !/^[a-zA-Z0-9/_.-]+$/.test(target) ||
    target.startsWith("-") ||
    target.startsWith("origin/") ||
    target.startsWith("refs/")
  )
    throw new Error("Invalid target branch.");
  await requireGit(ctx, root, ["rev-parse", "--verify", "--end-of-options", `refs/heads/${target}^{commit}`]);
  const ref = revision === "accepted" ? `refs/heads/${target}` : "HEAD";
  const head = await requireGit(ctx, root, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]);
  const result = revision === "accepted" ? await git(ctx, root, ["show", `${head}:${BOOK_PATH}`]) : null;
  let content: string | null = null;
  if (!result) content = await readWorkingText(ctx, root, BOOK_PATH);
  else if (!result.exitCode) content = result.stdout;
  const book = content ? parseBook(content) : null;
  return {
    workspaceId: workspace.id,
    root,
    branch,
    target,
    head,
    revision,
    content,
    digest: content ? digest(content) : "missing",
    book,
  };
};
export const replacementPatch = (before: string | null, after: string) => {
  const oldLines = before?.replace(/\n$/, "").split("\n") ?? [];
  const newLines = after.replace(/\n$/, "").split("\n");
  const header = before ? `--- a/${BOOK_PATH}` : "--- /dev/null";
  return `diff --git a/${BOOK_PATH} b/${BOOK_PATH}\n${before === null ? "new file mode 100644\n" : ""}${header}\n+++ b/${BOOK_PATH}\n@@ -${before ? 1 : 0},${oldLines.length} +1,${newLines.length} @@\n${oldLines.map((line) => `-${line}\n`).join("")}${newLines.map((line) => `+${line}\n`).join("")}`;
};
export const writeRepository = async (
  ctx: ExtensionContextBase,
  workspaceId: string,
  before: string | null,
  book: Book,
) => {
  const { workspace, root } = await resolveWorkspace(ctx, workspaceId, true);
  const current = await readRepository(ctx, workspaceId);
  if (current.branch === current.target || workspace.isDefault || workspace.is_default)
    throw new Error("Apply book changes in a working-branch workspace, not the accepted project folder.");
  if (current.content !== before) throw new Error("The book changed before application. Reload and reconcile.");
  if (!ctx.extensionFiles) throw new Error("Local extension files are unavailable.");
  const home = await ctx.workspaces.getDefault();
  const homePath = home?.rootPath ?? home?.root_path;
  if (!homePath) throw new Error("The project folder is unavailable.");
  const name = `patches/${ctx.storage.ids.create()}.patch`;
  await ctx.extensionFiles.writeText(name, replacementPatch(before, serializeBook(book)));
  try {
    const result = await git(ctx, root, [
      "apply",
      "--whitespace=nowarn",
      "--",
      join(homePath, ".pstdio/extension-storage", ctx.extensionId, name),
    ]);
    if (result.exitCode) throw new Error(`The working file changed or cannot be updated: ${result.stderr.trim()}`);
  } finally {
    await ctx.extensionFiles.delete(name);
  }
  return readRepository(ctx, workspaceId);
};
