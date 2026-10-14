export const createControlSaveQueue = () => {
  let previous: Promise<unknown> = Promise.resolve();
  return <T>(save: () => Promise<T>) => {
    const current = previous.then(save);
    previous = current.catch(() => undefined);
    return current;
  };
};
