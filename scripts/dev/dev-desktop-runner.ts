interface DesktopDevelopmentInput {
  start: () => Promise<void>;
  stop: () => void;
  reportCleanupFailure: (error: unknown) => void;
}

export const runDesktopDevelopment = async (input: DesktopDevelopmentInput) => {
  try {
    await input.start();
  } finally {
    try {
      input.stop();
    } catch (error) {
      input.reportCleanupFailure(error);
    }
  }
};
