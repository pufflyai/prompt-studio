import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { resolveImplementationBase } from "./implementation-targets";

// Git owns the delivery destination. A PR in another repository or target branch is reference material.
export const pullRequestTarget = async (ctx: ExtensionContextBase) => {
  const home = await ctx.workspaces.getDefault();
  if (!home?.root_path) return null;
  try {
    const base = await resolveImplementationBase(ctx, await ctx.settings.all());
    const remotes = await ctx.process.run({ command: ["git", "remote"], cwd: home.root_path });
    if (remotes.exitCode !== 0) return null;
    const remote =
      remotes.stdout
        .trim()
        .split(/\s+/)
        .find((name) => name && base.startsWith(`${name}/`)) ?? "origin";
    const branch = base.startsWith(`${remote}/`) ? base.slice(remote.length + 1) : base;
    const result = await ctx.process.run({ command: ["git", "remote", "get-url", remote], cwd: home.root_path });
    if (result.exitCode !== 0) return null;
    const url = result.stdout
      .trim()
      .replace(/^git@([^:]+):/, "https://$1/")
      .replace(/^ssh:\/\/git@/, "https://")
      .replace(/\.git$/, "")
      .replace(/\/$/, "")
      .toLowerCase();
    const parsed = new URL(url);
    return { repository: `https://${parsed.hostname}${parsed.pathname}`, branch };
  } catch {
    return null;
  }
};
