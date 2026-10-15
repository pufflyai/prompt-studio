/** One owner serializes migrations against its durable data version. */
export const createDataMigrationRunner = (store: {
  readVersion(): Promise<number>;
  writeVersion(version: number): Promise<void>;
}) => {
  let pending = Promise.resolve();
  return (version: number, run: (previousVersion: number) => Promise<void>) => {
    const result = pending.then(async () => {
      if (!Number.isSafeInteger(version) || version < 1)
        throw new Error("Migration version must be a positive safe integer.");
      const previous = await store.readVersion();
      if (!Number.isSafeInteger(previous) || previous < 0) throw new Error("Stored migration version is invalid.");
      if (previous > version) throw new Error("Stored data has a newer migration version.");
      if (previous === version) return;
      await run(previous);
      await store.writeVersion(version);
    });
    pending = result.catch(() => {});
    return result;
  };
};
