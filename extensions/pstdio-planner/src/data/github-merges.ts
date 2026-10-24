import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import type { Ticket } from "./types";

export const githubReviewLinks = (tickets: Ticket[]) => {
  const links = new Map<string, string[]>();
  for (const ticket of tickets) {
    for (const link of ticket.reviewLinks ?? []) {
      if (link.provider !== "github" || link.kind !== "pull_request") continue;
      links.set(link.url, [...(links.get(link.url) ?? []), ticket.id]);
    }
  }
  return links;
};

export const readGithubMerge = async <T>(
  ctx: Pick<ExtensionContextBase, "process" | "logger">,
  command: string[],
  cwd: string | undefined,
  parse: (output: string) => T,
) => {
  try {
    const result = await ctx.process.run({ command, cwd });
    if (result.exitCode !== 0) {
      ctx.logger.warn(`Could not check GitHub merge: ${result.stderr}`);
      return null;
    }
    return parse(result.stdout);
  } catch (error) {
    ctx.logger.warn(`Could not check GitHub merge: ${String(error)}`);
    return null;
  }
};
