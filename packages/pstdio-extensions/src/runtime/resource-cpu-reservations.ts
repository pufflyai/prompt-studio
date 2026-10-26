// One JavaScript process can have several waiting calls, but its CPU estimate is shared.
// Compiler children use distinct groups; their reservations remain additive.
export const createCpuReservations = () => {
  const groups = new Map<object, Map<object, number>>();
  let total = 0;
  const maximum = (group?: Map<object, number>) => Math.max(0, ...(group?.values() ?? []));
  return {
    idle: (group: object) => !groups.has(group),
    set: (groupId: object, job: object, amount: number) => {
      const group = groups.get(groupId) ?? new Map<object, number>();
      const before = maximum(group);
      if (amount) group.set(job, amount);
      else group.delete(job);
      total += maximum(group) - before;
      if (group.size) groups.set(groupId, group);
      else groups.delete(groupId);
    },
    get total() {
      return total;
    },
  };
};
