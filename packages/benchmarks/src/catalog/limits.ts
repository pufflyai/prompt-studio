import { desktopBudgets, rendererBudgets } from "../budget-limits";
import { isBelowBudget } from "../budgets";
import type { BenchmarkUnit } from "../writer";

const approval = "User-approved 2026-11-14: aligned B1–B8 targets on Linux x64, Apple Silicon Mac and Windows x64";
const elapsed: Record<string, Record<string, number>> = {
  B1: { usable: 5_000, "first-interaction": 1_200 },
  B2: { usable: 5_000, "first-interaction": 250 },
  B3: { attachment: 1_800, usable: 5_000, "first-interaction": 250 },
  B4: {
    input: 250,
    history: 250,
    file: 1_500,
    terminal: 250,
    panel: 500,
    "project-switch": 2_000,
    "stream-to-paint": 250,
    "longest-stall": 200,
    completion: 10_000,
    cancellation: 500,
  },
  B7: { "cold-read": 300, "warm-read": 180, edit: 120, "contended-read": 120 },
  B8: { usable: 6_000, "first-action": 300 },
};

// Human-approved targets use strict < for milliseconds and bytes. Retained renderer
// share guards keep their original inclusive boundary.
export const meetsLimit = (value: number, budget: number, unit: BenchmarkUnit) =>
  unit === "share" ? Number.isFinite(value) && value <= budget : isBelowBudget(value, budget);

export const retainedLimit = (scenario: string, metric: string, platform: string = process.platform) => {
  const desktop = desktopBudgets();
  if (scenario === "B1" && metric === "window") return desktop.startupWindowMs;
  if (scenario === "B1" && metric === "shell") return desktop.coldStartMs;
  if (scenario === "B8" && metric === "feedback") return desktop.recoveryMs;
  const milliseconds = elapsed[scenario]?.[metric];
  if (milliseconds !== undefined) return { value: milliseconds, evidence: approval };
  if (scenario === "B4")
    return (
      {
        script: rendererBudgets.streamingScript,
        task: rendererBudgets.streamingTask,
        "idle-script": rendererBudgets.idleScript,
        "idle-task": rendererBudgets.idleTask,
      } as Record<string, { value: number; evidence: string }>
    )[metric];
  if (scenario === "B5" && metric === "native-average")
    return { value: platform === "win32" ? 3_000_000_000 : 2_000_000_000, evidence: approval };
};
