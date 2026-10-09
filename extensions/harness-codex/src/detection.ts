import type { HarnessContext } from "@pstdio/sdk/extensions";

// 0.157.0 is the oldest release whose app-server protocol matches every request, notification, and
// item this harness uses. There is no upper bound: Codex ships every few days with additive protocol
// changes, and the harness ignores items it does not know. See ADR 0064.
export const MINIMUM_VERSION = "0.157.0";

const unavailable = (ctx: HarnessContext, reason: string, version?: string) => {
  ctx.logger.warn(reason);
  return { available: false, reason, ...(version ? { version } : {}) };
};

export const detectCodex = async (ctx: HarnessContext) => {
  try {
    // Model listing also calls this probe without the host availability wrapper.
    const result = await ctx.process.run({ command: ["codex", "--version"], timeoutMs: 3_000 });
    if (result.exitCode !== 0)
      return unavailable(ctx, "`codex --version` failed. Check the Codex installation on the runtime PATH.");
    const version = [result.stdout, result.stderr]
      .map((value) => Bun.stripANSI(value).trim())
      .find((value) => /^(?:codex-cli\s+)?\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(value));
    if (!version)
      return unavailable(
        ctx,
        "`codex --version` did not print a version. Check the Codex installation on the runtime PATH.",
      );
    const number = version.match(/\d+\.\d+\.\d+/)?.[0] ?? version;
    if (!Bun.semver.satisfies(number, `>=${MINIMUM_VERSION}`))
      return unavailable(ctx, `Requires Codex ${MINIMUM_VERSION} or newer. Found ${number}.`, version);
    return { available: true, version };
  } catch {
    // Avoid logging raw process output or environment values.
    return unavailable(ctx, "Codex could not run. Install Codex or check the runtime PATH.");
  }
};
