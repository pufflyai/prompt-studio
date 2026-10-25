import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServeRuntime } from "./serve-runtime";

test("persists shutdown intent before broadcasting and retains it after cleanup and replacement", () => {
  const home = mkdtempSync(join(tmpdir(), "serve-shutdown-intent-"));
  const descriptorPath = join(home, "runtime.json");
  const receiptPath = `${descriptorPath}.shutdown`;
  const runtime = createServeRuntime({ ownerType: "persistent", descriptorPath }, async () => {})!;
  try {
    const descriptor = runtime.publish("http://127.0.0.1:43127");
    let observed = false;
    runtime.host.subscribe(() => {
      expect(JSON.parse(readFileSync(receiptPath, "utf8"))).toEqual({
        pid: descriptor.pid,
        instanceId: descriptor.instanceId,
      });
      observed = true;
    });
    runtime.host.announceShutdown();
    expect(observed).toBe(true);
    runtime.cleanup();
    const replacement = createServeRuntime({ ownerType: "persistent", descriptorPath }, async () => {})!;
    replacement.publish("http://127.0.0.1:43128");
    replacement.cleanup();
    expect(JSON.parse(readFileSync(receiptPath, "utf8")).instanceId).toBe(descriptor.instanceId);
    if (process.platform !== "win32") expect(statSync(receiptPath).mode & 0o777).toBe(0o600);
  } finally {
    runtime.cleanup();
    rmSync(home, { recursive: true, force: true });
  }
});

test("does not announce shutdown when its intent cannot be persisted", () => {
  const home = mkdtempSync(join(tmpdir(), "serve-shutdown-write-failure-"));
  const descriptorPath = join(home, "runtime.json");
  const runtime = createServeRuntime({ ownerType: "persistent", descriptorPath }, async () => {})!;
  let announced = false;
  try {
    mkdirSync(`${descriptorPath}.shutdown`);
    runtime.host.subscribe(() => {
      announced = true;
    });
    expect(() => runtime.host.announceShutdown()).toThrow();
    expect(announced).toBe(false);
    expect(readdirSync(home)).toEqual(["runtime.json.shutdown"]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
