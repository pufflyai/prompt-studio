import type { HarnessContext } from "@pstdio/sdk/extensions";

// 2.1.203 is the first release that reports `background_tasks_changed` in stream JSON. Older releases
// end the run at the first result and kill the agent's background tasks. There is no upper bound
// because Claude Code ships almost daily and the harness ignores events it does not know.
const MINIMUM_VERSION = "2.1.203";

export const detectClaude = async (ctx: HarnessContext) => {
  try {
    // CLAUDECODE is cleared so a nested session is not mistaken for the CLI itself.
    // Model listing also calls this probe without the host availability wrapper.
    const result = await ctx.process.run({
      command: ["claude", "--version"],
      env: { CLAUDECODE: "" },
      timeoutMs: 3_000,
    });
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
    const number = version.match(/\d+\.\d+\.\d+/)?.[0];
    const available = Boolean(number && Bun.semver.satisfies(number, `>=${MINIMUM_VERSION}`));
    if (!available)
      ctx.logger.warn(
        `The selected Claude Code CLI must be version ${MINIMUM_VERSION} or newer. Upgrade that installation.`,
      );
    return { available, version };
  } catch {
    // Avoid logging raw process output or environment values.
    ctx.logger.warn("Claude Code version probe could not run. Check the runtime PATH and CLI installation.");
    return { available: false };
  }
};
