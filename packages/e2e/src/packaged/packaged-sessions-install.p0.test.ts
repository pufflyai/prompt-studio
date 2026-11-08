import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { expectSessionsDevelopment } from "./packaged-sessions-install-smoke";

test("runner cancellation reaps a Sessions authoring watcher before its source is removed", async () => {
  const child = spawn("bun", ["-e", "setInterval(() => {}, 1000)"], { stdio: "pipe" });
  const result = expectSessionsDevelopment(child, "/authoring/source").catch((error: Error) => error);
  await stopPendingTestProcesses();
  expect(await result).toMatchObject({ message: "Test ended before process completed" });
  expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  expect(child.listenerCount("exit")).toBe(0);
  expect(child.stdout?.listenerCount("data")).toBe(0);
});
