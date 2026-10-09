import type { HarnessContext } from "@pstdio/sdk/extensions";

export const detectClaude = async (ctx: HarnessContext) => {
  try {
    // CLAUDECODE is cleared so a nested session is not mistaken for the CLI itself.
    const result = await ctx.process.run({ command: ["claude", "--version"], env: { CLAUDECODE: "" } });
    if (result.exitCode !== 0) {
      ctx.logger.warn("Claude Code version probe failed. Check the CLI selected by the runtime PATH.");
      return { available: false };
    }
    const version = [result.stdout, result.stderr]
      .map((value) => Bun.stripANSI(value).trim())
      .find((value) => /^v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?(?:\s+\(Claude Code\))?$/i.test(value));
    if (!version) {
      ctx.logger.warn(
        "Claude Code did not return a recognized CLI version. Check the CLI selected by the runtime PATH.",
      );
      return { available: false };
    }
    return { available: true, version };
  } catch {
    // Avoid logging raw process output or environment values.
    ctx.logger.warn("Claude Code version probe could not run. Check the runtime PATH and CLI installation.");
    return { available: false };
  }
};
