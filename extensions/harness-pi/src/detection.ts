import type { HarnessContext } from "@pstdio/sdk/extensions";

export const MINIMUM_VERSION = "0.73.1";

export const detectPi = async (ctx: HarnessContext) => {
  try {
    const result = await ctx.process.run({ command: ["pi", "--version"], timeoutMs: 3000 });
    const version = [result.stdout, result.stderr]
      .map((text) => Bun.stripANSI(text).trim())
      .find((text) => /^\d+\.\d+\.\d+$/.test(text));
    if (result.exitCode === 0 && version && Bun.semver.satisfies(version, `>=${MINIMUM_VERSION}`))
      return { available: true, version };
    return {
      available: false,
      version,
      reason: `Requires Pi ${MINIMUM_VERSION} or newer. Install Pi or check the runtime PATH.`,
    };
  } catch {
    return { available: false, reason: "Install Pi or check the runtime PATH." };
  }
};
