import type { ChildProcess } from "node:child_process";
import { stopChildProcess } from "./child-process";

// Runners use one worker. Entries belong to operations that have not returned a process to a caller.
const pending = new Map<ChildProcess, AbortController>();

export const registerPendingTestProcess = (child: ChildProcess) => {
  const controller = new AbortController();
  pending.set(child, controller);
  return { signal: controller.signal, finish: () => pending.delete(child) };
};

export const stopPendingTestProcesses = async () => {
  const entries = [...pending];
  for (const [, controller] of entries) controller.abort(new Error("Test ended before process completed"));
  await Promise.all(entries.map(([child]) => stopChildProcess(child)));
};
