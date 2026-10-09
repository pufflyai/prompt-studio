import type { HarnessContext } from "@pstdio/sdk/extensions";

// 1.0.175 is the first release that serves `/global/health` and `/question`. The harness finds its
// server through the health check and asks the agent's questions through the question API. There
// is no upper bound because OpenCode ships several times a week.
export const MINIMUM_VERSION = "1.0.175";

const unavailable = (ctx: HarnessContext, reason: string, version?: string) => {
  ctx.logger.warn(reason);
  return { available: false, reason, ...(version ? { version } : {}) };
};

export const detectOpencode = async (ctx: HarnessContext) => {
  try {
    // Model listing also calls this probe without the host availability wrapper.
    const result = await ctx.process.run({ command: ["opencode", "--version"], timeoutMs: 3_000 });
    if (result.exitCode !== 0)
      return unavailable(ctx, "`opencode --version` failed. Check the OpenCode installation on the runtime PATH.");
    const version = [result.stdout, result.stderr]
      .map((value) => Bun.stripANSI(value).trim())
      .find((value) => /^(?:opencode\s+)?v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/i.test(value));
    if (!version)
      return unavailable(
        ctx,
        "`opencode --version` did not print a version. Check the OpenCode installation on the runtime PATH.",
      );
    const number = version.match(/\d+\.\d+\.\d+/)?.[0] ?? version;
    if (!Bun.semver.satisfies(number, `>=${MINIMUM_VERSION}`))
      return unavailable(
        ctx,
        `OpenCode ${number} is too old. Update OpenCode to ${MINIMUM_VERSION} or newer.`,
        version,
      );
    return { available: true, version };
  } catch {
    // Avoid logging raw process output or environment values.
    return unavailable(ctx, "OpenCode could not run. Install OpenCode or check the runtime PATH.");
  }
};
