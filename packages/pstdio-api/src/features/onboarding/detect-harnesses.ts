import type { OnboardingHarness } from "pstdio-api-contracts";
import { createProcessApi } from "../extensions/extension-process-api";

const probes: { id: OnboardingHarness; command: string }[] = [
  { id: "codex", command: "codex" },
  { id: "open-code", command: "opencode" },
  { id: "claude-code", command: "claude" },
  { id: "pi", command: "pi" },
];

// Probe PATH only. Listing choices must never acquire a fallback CLI.
export const detectOnboardingHarnesses = async () => {
  const process = createProcessApi();
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
