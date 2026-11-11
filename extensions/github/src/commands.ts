import { defineCommand, l10n, params, type ResourceRef } from "@pstdio/sdk/extensions";
import { runGithub } from "./github-process";
import { importPullRequest, parsePullRequest, pullRequestResource, readPullRequests } from "./pull-requests";
export const importPr = defineCommand({
  id: "pull-requests.import",
  title: l10n("commands.import", "Import pull request"),
  cli: true,
  mutating: true,
  params: { url: params.text({ required: true }) },
  run: (ctx, input) => importPullRequest(ctx, input.url),
});
export const readPrs = defineCommand({
  id: "pull-requests.read",
  title: l10n("commands.read", "Read pull request evidence"),
  cli: true,
  params: { ids: params.json<string[]>() },
  run: (ctx, input) => readPullRequests(ctx, input.ids ?? []),
});
export const resolvePrs = defineCommand({
  id: "pull-requests.resolve",
  title: l10n("commands.resolve", "Resolve pull requests"),
  params: { resources: params.json<ResourceRef[]>() },
  async run(ctx, input) {
    return (input.resources ?? []).flatMap((ref) => {
      const pr =
        ref.type === "pull-request" &&
        ref.extensionId === ctx.extensionId &&
        (!ref.projectId || ref.projectId === ctx.projectId)
          ? parsePullRequest(ref.id)
          : null;
      if (!pr) return [];
      const resource = pullRequestResource(pr, ctx.projectId);
      return [
        { resource, target: { kind: "page" as const, page: { kind: "page" as const, id: "pull-request" }, resource } },
      ];
    });
  },
});

export const findMergedPrs = defineCommand({
  id: "pull-requests.find-merged",
  title: l10n("commands.findMerged", "Find merged pull requests for branches"),
  cli: true,
  params: { branches: params.json<string[]>() },
  async run(ctx, input) {
    const home = await ctx.workspaces.getDefault();
    if (!home?.root_path) return [];
    const results: { branch: string; id: string }[] = [];
    const branches = [...new Set(input.branches ?? [])];
    if (branches.length > 100) throw new Error("Read at most 100 branches.");
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(8, branches.length) }, async () => {
        while (next < branches.length) {
          const branch = branches[next++]!;
          try {
            const result = await runGithub(ctx, {
              command: ["gh", "pr", "list", "--head", branch, "--state", "merged", "--json", "url"],
              cwd: home.root_path!,
            });
            if (result.exitCode !== 0) continue;
            const prs = JSON.parse(result.stdout) as { url: string }[];
            for (const value of prs) {
              const pr = parsePullRequest(value.url);
              if (pr) results.push({ branch, id: pr.id });
            }
          } catch {
            /* Missing GitHub data cannot establish a merge. */
          }
        }
      }),
    );
    return results;
  },
});
