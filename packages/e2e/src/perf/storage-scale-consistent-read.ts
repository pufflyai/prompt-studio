/**
 * A page and its counts are separate reads. Writes arriving between them, such as a sync
 * background, change the revision, so read again until all parts describe one revision.
 */
export const consistentRead = async <T extends { consistent: boolean }>(read: () => Promise<T>) => {
  for (let attempts = 1; ; attempts++) {
    const value = await read();
    if (value.consistent) return { attempts, value };
    if (attempts === 10) throw new Error("Scale rows kept changing while reading one page");
  }
};
