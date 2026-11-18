import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

export const git = async (ctx: Pick<ExtensionContextBase, "process">, args: string[], cwd?: string) =>
  (await ctx.process.runOrThrow({ command: ["git", ...args], ...(cwd ? { cwd } : {}) })).stdout.trim();
