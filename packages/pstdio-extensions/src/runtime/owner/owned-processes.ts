import type { ProcessIdentity } from "../process-sampler";

export const ownedProcesses = (root: number, table: ProcessIdentity[]) => {
  const descendants = new Map<number, number[]>();
  for (const process of table) {
    const children = descendants.get(process.parentPid) ?? [];
    children.push(process.pid);
    descendants.set(process.parentPid, children);
  }
  const owned = new Set<number>();
  const pending = [root, ...table.filter((process) => process.groupId === root).map((process) => process.pid)];
  while (pending.length) {
    const pid = pending.pop()!;
    if (owned.has(pid)) continue;
    owned.add(pid);
    pending.push(...(descendants.get(pid) ?? []));
  }
  return table.filter((process) => owned.has(process.pid));
};
