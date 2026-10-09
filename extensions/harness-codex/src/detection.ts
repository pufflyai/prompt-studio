import type { HarnessContext } from "@pstdio/sdk/extensions";

export const detectCodex = async (ctx: HarnessContext) => {
  try {
    // Model listing also calls this probe without the host availability wrapper.
    const result = await ctx.process.run({ command: ["codex", "--version"], timeoutMs: 3_000 });
    if (result.exitCode !== 0) {
      ctx.logger.warn("Codex version probe failed. Check the CLI selected by the runtime PATH.");
      return { available: false };
    }
    const version = [result.stdout, result.stderr]
      .map((value) => Bun.stripANSI(value).trim())
      .find((value) => /^(?:codex-cli\s+)?\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(value));
    if (!version) {
      ctx.logger.warn("Codex did not return a recognized CLI version. Check the CLI selected by the runtime PATH.");
      return { available: false };
    }
    const number = version.match(/\d+\.\d+\.\d+/)?.[0];
    const available = Boolean(number && Bun.semver.satisfies(number, "^0.160.1"));
    if (!available) ctx.logger.warn("The selected Codex CLI must satisfy version ^0.160.1. Upgrade that installation.");
    return { available, version };
  } catch {
    // Avoid logging raw process output or environment values.
    ctx.logger.warn("Codex version probe could not run. Check the runtime PATH and CLI installation.");
    return { available: false };
  }
};
