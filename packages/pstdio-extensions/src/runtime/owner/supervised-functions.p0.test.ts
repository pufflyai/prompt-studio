import { expect, test } from "bun:test";
import { createSupervisedFunctionWrapper } from "./supervised-functions";

test("a command failure in a live owner does not wait for process exit", async () => {
  let exitWaits = 0;
  const wrap = createSupervisedFunctionWrapper({
    sourcePath: "source",
    cpuGroup: {},
    isLive: () => true,
    generation: () => 1,
    recover: async () => {},
    signal: () => new AbortController().signal,
    awaitExit: async () => {
      exitWaits++;
    },
    watchSignal: () => () => {},
  });
  const failure = Object.assign(new Error("command failed"), { code: "command_failure" });
  const run = wrap(async () => {
    throw failure;
  }) as () => Promise<unknown>;
  await expect(run()).rejects.toBe(failure);
  expect(exitWaits).toBe(0);
});
