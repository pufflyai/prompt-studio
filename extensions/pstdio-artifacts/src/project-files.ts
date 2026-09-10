import { type ExtensionContextBase, type Struct, unwrapCommandOutcome } from "@pstdio/sdk/extensions";

export const withProjectFiles = async <TParams extends Struct, TResult>(
  ctx: ExtensionContextBase,
  commandId: string,
  input: TParams,
  run: () => Promise<TResult>,
) => {
  if (ctx.workspaceFiles || ctx.repoFiles) return run();
  const repo = await ctx.repos.getDefault();
  if (!repo) throw new Error("Link a repository to this project before publishing HTML.");
  const outcome = await ctx.commands.execute<TParams, TResult>(
    { kind: "command", id: commandId, extensionId: ctx.extensionId },
    { params: input, repoId: repo.repoId, repoPath: repo.path },
  );
  return unwrapCommandOutcome({ outcome });
};
