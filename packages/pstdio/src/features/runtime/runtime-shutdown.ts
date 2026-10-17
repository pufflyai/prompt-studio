import { randomUUID } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RuntimeDescriptor } from "./runtime-descriptor";

type ShutdownReceipt = Pick<RuntimeDescriptor, "pid" | "instanceId">;

// Keep the latest intentional stop across descriptor cleanup and future starts. Desktop
// snapshots it on attachment, so later stops remain visible even if their SSE event is lost.
export const writeRuntimeShutdown = (descriptorPath: string, identity: ShutdownReceipt) => {
  const path = `${descriptorPath}.shutdown`;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const fd = openSync(temporaryPath, "wx", 0o600);
  try {
    try {
      writeFileSync(fd, JSON.stringify({ pid: identity.pid, instanceId: identity.instanceId }));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
};

export const readRuntimeShutdown = (descriptorPath: string) => {
  try {
    const receipt = JSON.parse(readFileSync(`${descriptorPath}.shutdown`, "utf8")) as Partial<ShutdownReceipt> | null;
    if (typeof receipt?.pid !== "number" || !Number.isInteger(receipt.pid) || receipt.pid < 1) return null;
    if (typeof receipt.instanceId !== "string" || !receipt.instanceId) return null;
    return { pid: receipt.pid, instanceId: receipt.instanceId };
  } catch {
    return null;
  }
};
