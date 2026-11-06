import type { HarnessContext } from "@pstdio/sdk/extensions";
import { resolveOpencodeCommand } from "./cli";

// The harness uses the OpenCode 2 API and integration-based authentication, verified from 2.2.5.
export const MINIMUM_VERSION = "2.2.5";

const unavailable = (ctx: HarnessContext, reason: string, version?: string) => {
  ctx.logger.warn(reason);
  return { available: false, reason, ...(version ? { version } : {}) };
};

export const detectOpencode = async (ctx: HarnessContext) => {
  try {
    // Model listing also calls this probe without the host availability wrapper.
    const command = resolveOpencodeCommand();
    const result = await ctx.process.run({ command: [command, "--version"], timeoutMs: 3_000 });
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
      return unavailable(ctx, `Requires OpenCode ${MINIMUM_VERSION} or newer. Found ${number}.`, version);
    return { available: true, version };
  } catch {
    // Avoid logging raw process output or environment values.
    return unavailable(ctx, "OpenCode could not run. Install OpenCode or check the runtime PATH.");
  }
};
