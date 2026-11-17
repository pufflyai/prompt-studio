import { availableParallelism, totalmem } from "node:os";

// Leave CPU time for the workbench and allow one worker per 4 GiB of host or container memory.
export const upgradeWorkerCount = (cores: number, memoryBytes: number): 1 | 2 | 3 | 4 => {
  const capacity = Math.min(Math.floor(cores / 2), Math.floor(memoryBytes / (4 * 1024 ** 3)));
  if (capacity >= 4) return 4;
  if (capacity >= 3) return 3;
  if (capacity >= 2) return 2;
  return 1;
};

const hostMemory = totalmem();
const memoryLimit = process.constrainedMemory();
export const extensionUpgradeConcurrency = upgradeWorkerCount(
  availableParallelism(),
  memoryLimit > 0 ? Math.min(hostMemory, memoryLimit) : hostMemory,
);
