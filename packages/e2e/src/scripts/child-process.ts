import type { ChildProcess } from "node:child_process";
import { once } from "node:events";

export const stopChildProcess = async (child: ChildProcess | undefined) => {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  const exited = once(child, "exit");
  child.kill();
  await exited;
};
