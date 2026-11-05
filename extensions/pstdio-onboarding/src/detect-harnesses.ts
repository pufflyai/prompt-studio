import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import type { OnboardingHarness } from "./types";

const probes: { id: OnboardingHarness; command: string }[] = [
  { id: "codex", command: "codex" },
  { id: "open-code", command: "opencode" },
  { id: "claude-code", command: "claude" },
  { id: "pi", command: "pi" },
];
export const detectHarnesses = async (process: ExtensionContextBase["process"]) => {
  const detected = await Promise.all(
    probes.map(async ({ id, command }) => {
      const executable = Bun.which(command);
      if (!executable) return null;
      try {
        const result = await process.run({ command: [executable, "--version"], timeoutMs: 3_000 });
        return result.exitCode === 0 && /\d+\.\d+\.\d+/.test(result.stdout + result.stderr) ? id : null;
      } catch {
        return null;
      }
    }),
  );
  return detected.filter((id) => id !== null);
};
