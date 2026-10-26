import type { HarnessContext } from "@pstdio/sdk/extensions";
import { resolvePiCommand } from "./cli";
import type { PiProcessOptions } from "./process";

export const MINIMUM_VERSION = "0.73.1";

export const detectPi = async (ctx: HarnessContext, options: PiProcessOptions = {}) => {
  try {
    const resolved = options.command ? { command: options.command, env: {} } : resolvePiCommand();
    const result = await ctx.process.run({
      command: [...resolved.command, "--version"],
      env: { ...options.env, ...resolved.env },
      cwd: options.cwd,
      timeoutMs: 3000,
    });
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
