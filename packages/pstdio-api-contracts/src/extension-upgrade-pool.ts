// Older hosts do not advertise capacity and expect sequential updates.
export const createExtensionUpgradePool = (capacity = 1) => {
  const limit = Number.isFinite(capacity) ? Math.max(1, Math.min(4, Math.floor(capacity))) : 1;
  const waiting: (() => void)[] = [];
  let active = 0;
  return async <T>(upgrade: () => Promise<T>): Promise<T> => {
    if (active < limit) active++;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await upgrade();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
};
