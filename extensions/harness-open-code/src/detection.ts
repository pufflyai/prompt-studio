import type { HarnessContext } from "@pstdio/sdk/extensions";

export const detectOpencode = async (ctx: HarnessContext) => {
  try {
    const result = await ctx.process.run({ command: ["opencode", "--version"] });
    if (result.exitCode !== 0) {
      ctx.logger.warn("OpenCode version probe failed. Check the CLI selected by the runtime PATH.");
      return { available: false };
    }
    const version = [result.stdout, result.stderr]
      .map((value) => Bun.stripANSI(value).trim())
      .find((value) => /^(?:opencode\s+)?v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/i.test(value));
    if (!version) {
      ctx.logger.warn("OpenCode did not return a recognized CLI version. Check the CLI selected by the runtime PATH.");
      return { available: false };
    }
    return { available: true, version };
  } catch {
    // Avoid logging raw process output or environment values.
    ctx.logger.warn("OpenCode version probe could not run. Check the runtime PATH and CLI installation.");
    return { available: false };
  }
};
