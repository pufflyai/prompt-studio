import type { CommandContext } from "@pstdio/sdk/extensions";

// The fixture supplies GitHub's public command boundary; packaged coverage installs the real owner.
export const withGithubProvider = (ctx: CommandContext) => {
  const execute = ctx.commands.execute;
  ctx.commands.execute = (async (ref, input) => {
    if (ref.extensionId !== "pstdio.github") return execute(ref, input);
    const params = input?.params as { url?: string; ids?: string[]; branches?: string[] };
    if (ref.id === "pull-requests.import") {
      const url = new URL(params.url!);
      const id = `https://${url.hostname}${url.pathname.replace(/(\/pull\/\d+).*/, "$1")}`.toLowerCase();
      return { ok: true, value: { type: "pull-request", id, extensionId: "pstdio.github", projectId: ctx.projectId } };
    }
    if (ref.id === "pull-requests.find-merged") {
      const found = [];
      for (const branch of params.branches ?? []) {
        const result = await ctx.process.run({
          command: ["gh", "pr", "list", "--head", branch, "--state", "merged", "--json", "url"],
        });
        if (result.exitCode === 0)
          found.push(...JSON.parse(result.stdout).map(({ url }: { url: string }) => ({ branch, id: url })));
      }
      return { ok: true, value: found };
    }
    if (ref.id === "pull-requests.read") {
      return {
        ok: true,
        value: await Promise.all(
          (params.ids ?? []).map(async (id) => {
            const result = await ctx.process.run({
              command: [
                "gh",
                "pr",
                "view",
                id,
                "--json",
                "headRefOid,baseRefName,mergeable,statusCheckRollup,state,mergeCommit",
              ],
            });
            return result.exitCode === 0 ? { id, ...JSON.parse(result.stdout) } : { id, error: result.stderr };
          }),
        ),
      };
    }
    return execute(ref, input);
  }) as typeof execute;
  return ctx;
};
