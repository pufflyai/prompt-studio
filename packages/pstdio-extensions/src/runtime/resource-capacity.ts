import { readFile } from "node:fs/promises";
import { availableParallelism, freemem } from "node:os";

export interface ResourceCapacity {
  cpu: number;
  /** MiB available to new extension work after the host reserve. */
  memory: number;
  observations?: string[];
}

const read = (path: string) => readFile(path, "utf8").catch(() => undefined);
const finiteLimit = (value: string | undefined) => {
  const parsed = Number(value?.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export const reserveResourceCapacity = (cpu: number, memory: number, observations: string[]): ResourceCapacity => ({
  cpu: cpu - Math.min(1, cpu / 2),
  memory: Math.max(0, memory / 1024 ** 2 - 256),
  observations,
});

export const readResourceCapacity = async (): Promise<ResourceCapacity> => {
  let cpu = availableParallelism();
  let memory = freemem();
  const observations: string[] = [];
  if (process.platform === "linux") {
    const [quota, memoryLimit, memoryCurrent, quotaV1, periodV1, memoryLimitV1, memoryCurrentV1] = await Promise.all([
      read("/sys/fs/cgroup/cpu.max"),
      read("/sys/fs/cgroup/memory.max"),
      read("/sys/fs/cgroup/memory.current"),
      read("/sys/fs/cgroup/cpu/cpu.cfs_quota_us"),
      read("/sys/fs/cgroup/cpu/cpu.cfs_period_us"),
      read("/sys/fs/cgroup/memory/memory.limit_in_bytes"),
      read("/sys/fs/cgroup/memory/memory.usage_in_bytes"),
    ]);
    const [quotaAmount, period] = (quota?.trim().split(/\s+/) ?? []).map(Number);
    const legacyQuota = finiteLimit(quotaV1);
    const legacyPeriod = finiteLimit(periodV1);
    if (quotaAmount! > 0 && period! > 0) cpu = Math.min(cpu, quotaAmount! / period!);
    else if (legacyQuota && legacyPeriod) cpu = Math.min(cpu, legacyQuota / legacyPeriod);
    else observations.push("CPU quota unavailable; using process affinity.");
    const limit = finiteLimit(memoryLimit) ?? finiteLimit(memoryLimitV1);
    const usage = finiteLimit(memoryCurrent) ?? finiteLimit(memoryCurrentV1);
    if (limit !== undefined && usage !== undefined) memory = Math.min(memory, Math.max(0, limit - usage));
    else observations.push("Container memory headroom unavailable; using system free memory.");
  }
  // These conservative rollout reserves are explicit policy, not a hard OS quota.
  return reserveResourceCapacity(cpu, memory, observations);
};
