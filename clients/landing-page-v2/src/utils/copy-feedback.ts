export const createCopyFeedbackController = (setCopied: (isCopied: boolean) => void, durationMs = 1000) => {
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  const markCopied = () => {
    setCopied(true);

    if (resetTimer) {
      clearTimeout(resetTimer);
    }

    resetTimer = setTimeout(() => {
      setCopied(false);
      resetTimer = null;
    }, durationMs);
  };

  const dispose = () => {
    if (!resetTimer) return;
    clearTimeout(resetTimer);
    resetTimer = null;
  };

  return {
    markCopied,
    dispose,
  };
};
