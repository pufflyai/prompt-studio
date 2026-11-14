import { cpus, totalmem } from "node:os";
import { desktopBudgets, rendererBudgets } from "../budget-limits";
export const retainedLimit = (scenario: string, metric: string) => {
  const desktop = desktopBudgets();
  if (
    scenario === "B1" &&
    metric === "usable" &&
    /Apple M5$/.test(cpus()[0]?.model ?? "") &&
    cpus().length === 10 &&
    totalmem() === 32 * 1024 ** 3
  )
    return {
      value: 2_000,
      evidence: "003.3.1: reference M5 empty-home interactive workbench/API/default-tools target",
    };
  if (scenario === "B1" && metric === "window") return desktop.startupWindowMs;
  if (scenario === "B1" && metric === "shell") return desktop.coldStartMs;
  if (scenario === "B8" && metric === "feedback") return desktop.recoveryMs;
  if (scenario === "B4")
    return (
      {
        script: rendererBudgets.streamingScript,
        task: rendererBudgets.streamingTask,
        "idle-script": rendererBudgets.idleScript,
        "idle-task": rendererBudgets.idleTask,
      } as Record<string, { value: number; evidence: string }>
    )[metric];
  if (scenario === "B5" && metric === "native-average" && process.platform === "darwin")
    return { value: 2_000_000_000, evidence: "003.3.1: M5 whole-app physical footprint including compression" };
};
