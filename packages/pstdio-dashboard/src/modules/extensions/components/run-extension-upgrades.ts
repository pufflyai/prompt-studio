/** Match the host's catalog installation limit, keeping CPU and dependency work bounded. */
export const runExtensionUpgrades = async <T>(targets: T[], upgrade: (target: T) => Promise<unknown>) => {
  const queue = [...targets];
  const worker = async () => {
    while (queue.length) {
      const target = queue.shift()!;
      await upgrade(target);
    }
  };
  await Promise.all([worker(), worker()]);
};
