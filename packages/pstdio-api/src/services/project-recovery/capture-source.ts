import type { BigIntStats } from "node:fs";
import { createRecoveryPolicy } from "./policy";
import type { RecoverySourceHandle } from "./source-posix";

export const recoverySourceIdentity = (stat: BigIntStats) =>
  [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].map(String);
export const unchangedRecoverySource = (stat: BigIntStats, identity: string[]) =>
  recoverySourceIdentity(stat).every((value, index) => value === identity[index]);

export const sourceRecoveryPolicy = async (root: RecoverySourceHandle, firstEnrollment: boolean) => {
  if (firstEnrollment) {
    try {
      await root.create(".pstignore", new TextEncoder().encode("node_modules/\n"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  let file: RecoverySourceHandle;
  try {
    file = await root.open(".pstignore", true);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return createRecoveryPolicy(null);
    throw error;
  }
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size > 768n * 1024n)
      throw new Error("The recovery policy must be a regular UTF-8 file within the metadata page limit");
    const bytes = new Uint8Array(Number(before.size) + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const count = await file.read(bytes.subarray(offset), offset);
      if (!count) break;
      offset += count;
    }
    if (offset !== Number(before.size) || !unchangedRecoverySource(await file.stat(), recoverySourceIdentity(before)))
      throw new Error("The recovery policy changed during capture");
    return createRecoveryPolicy(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, offset)));
  } finally {
    file.close();
  }
};

export const verifyRecoverySource = async (root: RecoverySourceHandle, path: string, identity: string[]) => {
  let current = root;
  try {
    const parts = path ? path.split("/") : [];
    for (const [index, part] of parts.entries()) {
      const next = await current.open(part, index < parts.length - 1);
      if (current !== root) current.close();
      current = next;
    }
    if (!unchangedRecoverySource(await current.stat(), identity))
      throw new Error("An included source entry changed during capture");
  } finally {
    if (current !== root) current.close();
  }
};
