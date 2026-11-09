export const createStreamRecovery = (retry: () => void) => {
  let delay = 2000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    failed() {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        retry();
      }, delay);
      delay = Math.min(delay * 2, 30_000);
    },
    succeeded() {
      delay = 2000;
    },
    close() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
};
