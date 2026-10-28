import type { HarnessContext } from "pstdio-api-contracts/extension-kernel";

/** Reuse a usable global CLI before acquiring its private pinned package. */
export const prepareHarnessPackage = async (
  ctx: HarnessContext,
  input: {
    command: string[];
    minimumVersion: string;
    name: string;
    version: string;
    env?: Record<string, string>;
  },
) => {
  try {
    const result = await ctx.process.run({
      command: [...input.command, "--version"],
      env: input.env,
      timeoutMs: 3_000,
    });
    const version = `${result.stdout}\n${result.stderr}`.match(/\b\d+\.\d+\.\d+(?:-[\w.-]+)?\b/)?.[0];
    if (result.exitCode === 0 && version && Bun.semver.satisfies(version, `>=${input.minimumVersion}`)) return null;
  } catch {
    /* An unavailable global command needs the pinned fallback. */
  }
  if (!ctx.packages) throw new Error("This host does not support on-demand harness packages.");
  return ctx.packages.ensure({ name: input.name, version: input.version });
};
