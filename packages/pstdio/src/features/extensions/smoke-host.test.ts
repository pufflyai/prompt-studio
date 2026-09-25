import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { stopSmokeProcess } from "./smoke-host";

test("stops and reaps a child before cleanup completes", async () => {
  const child = spawn(process.execPath, ["-e", 'console.log("ready");setInterval(()=>{},1000)'], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  await once(child.stdout!, "data");
  await stopSmokeProcess(child);
  expect(child.signalCode).toBe("SIGTERM");
  await stopSmokeProcess(child);
  expect(() => process.kill(child.pid!, 0)).toThrow();
});
