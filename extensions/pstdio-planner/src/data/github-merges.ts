import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import type { StoredTicket } from "./types";

export const githubReviewLinks = (tickets: StoredTicket[]) => {
  const links = new Map<string, string[]>();
  for (const ticket of tickets) {
    for (const link of ticket.reviewLinks ?? []) {
      if (link.provider !== "github" || link.kind !== "pull_request") continue;
      links.set(link.url, [...(links.get(link.url) ?? []), ticket.id]);
    }
  }
  return links;
};

export const readGithubMerge = async (
  ctx: Pick<ExtensionContextBase, "process" | "logger">,
  command: string[],
  cwd: string | undefined,
  isMerged: (output: string) => boolean,
) => {
  try {
    const result = await ctx.process.run({ command, cwd });
    if (result.exitCode !== 0) {
      ctx.logger.warn(`Could not check GitHub merge: ${result.stderr}`);
      return false;
    }
    return isMerged(result.stdout);
  } catch (error) {
    ctx.logger.warn(`Could not check GitHub merge: ${String(error)}`);
    return false;
  }
};
