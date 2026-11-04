// A row lock serializes separate transactions, but overlapping calls inside one transaction
// also need the preceding save to finish before reading the state it wrote.
export const createCommitQueue = () => {
  let previous = Promise.resolve();
  const run = <T>(save: () => Promise<T>) => {
    const result = previous.then(save);
    // Preserve the caller's rejection while allowing a caught validation error to be followed
    // by a valid commit in the same transaction.
    previous = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  return { run, settled: () => previous };
};
