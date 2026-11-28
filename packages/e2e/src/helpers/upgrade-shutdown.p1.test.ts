import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { stopUpgradeProcess } from "../packaged/project-upgrade-shutdown";

test.skipIf(process.platform === "win32")("reports a stuck upgrade host and terminates it", async () => {
  const child = spawn(process.execPath, [
    "-e",
    'process.on("SIGTERM", () => {}); console.log("ready"); setInterval(() => {}, 1000)',
  ]);
  try {
    await once(child.stdout, "data");
    const exited = once(child, "exit");
    const stopped = stopUpgradeProcess(child, 100);
    expect(stopUpgradeProcess(child)).toBe(stopped);
    await expect(stopped).rejects.toThrow("did not close within 100 ms");
    expect(await exited).toEqual([null, "SIGKILL"]);
  } finally {
    child.kill("SIGKILL");
  }
});
