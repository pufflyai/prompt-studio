import type { HarnessContext } from "@pstdio/sdk/extensions";

// 2.1.203 is the first release that reports `background_tasks_changed` in stream JSON. Older releases
// end the run at the first result and kill the agent's background tasks. There is no upper bound
// because Claude Code ships almost daily and the harness ignores events it does not know.
export const MINIMUM_VERSION = "2.1.203";

const unavailable = (ctx: HarnessContext, reason: string, version?: string) => {
  ctx.logger.warn(reason);
  return { available: false, reason, ...(version ? { version } : {}) };
};

export const detectClaude = async (ctx: HarnessContext) => {
  try {
    // CLAUDECODE is cleared so a nested session is not mistaken for the CLI itself.
    // Model listing also calls this probe without the host availability wrapper.
    const result = await ctx.process.run({
      command: ["claude", "--version"],
      env: { CLAUDECODE: "" },
      timeoutMs: 3_000,
    });
    if (result.exitCode !== 0)
      return unavailable(ctx, "`claude --version` failed. Check the Claude Code installation on the runtime PATH.");
    const version = [result.stdout, result.stderr]
      .map((value) => Bun.stripANSI(value).trim())
      .find((value) => /^v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?(?:\s+\(Claude Code\))?$/i.test(value));
    if (!version)
      return unavailable(
        ctx,
        "`claude --version` did not print a version. Check the Claude Code installation on the runtime PATH.",
      );
    const number = version.match(/\d+\.\d+\.\d+/)?.[0] ?? version;
    if (!Bun.semver.satisfies(number, `>=${MINIMUM_VERSION}`))
      return unavailable(
        ctx,
        `Claude Code ${number} is too old. Update Claude Code to ${MINIMUM_VERSION} or newer.`,
        version,
      );
    return { available: true, version };
  } catch {
    // Avoid logging raw process output or environment values.
    return unavailable(ctx, "Claude Code could not run. Install Claude Code or check the runtime PATH.");
  }
};
