import { availableParallelism, totalmem } from "node:os";

// Keep a core for the workbench on small hosts. Larger pools reserve two cores and 4 GB per worker.
export const upgradeWorkerCount = (cores: number, memoryBytes: number): 1 | 2 | 3 | 4 => {
  const capacity = Math.min(Math.floor(cores / 2), Math.floor(memoryBytes / 4_000_000_000));
  if (capacity >= 4) return 4;
  if (capacity >= 3) return 3;
  if (cores >= 3 && memoryBytes >= 6_000_000_000) return 2;
  return 1;
};

const hostMemory = totalmem();
const memoryLimit = process.constrainedMemory();
export const extensionUpgradeConcurrency = upgradeWorkerCount(
  availableParallelism(),
  memoryLimit > 0 ? Math.min(hostMemory, memoryLimit) : hostMemory,
);
