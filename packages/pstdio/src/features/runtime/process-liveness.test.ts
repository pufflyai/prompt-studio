import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { isRuntimePidAlive } from "./process-liveness";

const readProcessState = (pid: number) => {
  const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
  return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[0];
};

// A detached runtime is adopted by PID 1. In a container without an init process, PID 1 may never
// reap it, so the exited runtime stays a zombie. Linux is the only platform that exposes this state.
test.skipIf(process.platform !== "linux")("treats an exited process that nobody reaped as stopped", async () => {
  // `sleep` never waits for children, so the exited `true` stays a zombie while `sleep` runs.
  const parent = Bun.spawn(["sh", "-c", "true & echo $!; exec sleep 30"], { stdout: "pipe" });
  try {
    const reader = parent.stdout.getReader();
    const { value } = await reader.read();
    reader.releaseLock();
    const pid = Number(new TextDecoder().decode(value).trim());
    while (readProcessState(pid) !== "Z") await Bun.sleep(10);

    expect(isRuntimePidAlive(parent.pid)).toBe(true);
    expect(isRuntimePidAlive(pid)).toBe(false);
  } finally {
    parent.kill("SIGKILL");
    await parent.exited;
  }
});
