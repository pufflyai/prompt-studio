/** Keep typing local through short bursts, with a bounded wait during continuous input. */
export const createMarkdownEditBatch = (publish: (group: object) => void) => {
  let pause: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let group = {};
  let lastInput = Number.NEGATIVE_INFINITY;
  const cancel = () => {
    clearTimeout(pause);
    clearTimeout(deadline);
    pause = undefined;
    deadline = undefined;
  };
  const flush = () => {
    if (deadline === undefined) return;
    cancel();
    publish(group);
  };
  return {
    pending: () => deadline !== undefined,
    group: () => group,
    schedule() {
      const now = Date.now();
      if (now - lastInput >= 500) group = {};
      lastInput = now;
      clearTimeout(pause);
      pause = setTimeout(flush, 300);
      deadline ??= setTimeout(flush, 1_000);
    },
    flush,
    cancel,
  };
};
