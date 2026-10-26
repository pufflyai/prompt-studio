import { availableParallelism, freemem } from "node:os";
import { readCgroupCapacity } from "./cgroup-capacity";

export interface ResourceCapacity {
  cpu: number;
  /** MiB available to new extension work after the host reserve. */
  memory: number;
  observations?: string[];
}

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
    const limits = await readCgroupCapacity();
    if (limits.cpu !== undefined) cpu = Math.min(cpu, limits.cpu);
    if (limits.memory !== undefined) memory = Math.min(memory, limits.memory);
    observations.push(...limits.observations);
  }
  // These conservative rollout reserves are explicit policy, not a hard OS quota.
  return reserveResourceCapacity(cpu, memory, observations);
};
