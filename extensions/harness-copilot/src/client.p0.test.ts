import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { stopAndKillSurvivor } from "./client";

test("a runtime that ignores SIGTERM during stop is killed afterwards", async () => {
  // A child that ignores SIGTERM, as a stuck Copilot runtime might.
  const child = spawn(process.execPath, [
    "-e",
    "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000);",
  ]);
  await once(child.stdout, "data");
  const exited = once(child, "exit");
  // Like SDK 1.0.34's stop(): send SIGTERM, give up waiting, and report an error instead of throwing.
  const errors = await stopAndKillSurvivor(child, async () => {
    child.kill("SIGTERM");
    await Bun.sleep(100);
    return [new Error("Timed out waiting for CLI process to exit after kill")];
  });
  expect(errors).toHaveLength(1);
  const [, signal] = await exited;
  expect(signal).toBe("SIGKILL");
});

test("a runtime that already exited is left alone", async () => {
  const child = spawn(process.execPath, ["-e", "process.exit(0)"]);
  await once(child, "exit");
  let killed = false;
  child.kill = () => {
    killed = true;
    return true;
  };
  await stopAndKillSurvivor(child, async () => []);
  expect(killed).toBe(false);
});
