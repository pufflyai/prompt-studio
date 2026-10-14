export const logTestPhase = (phase: string) => {
  process.stdout.write(`[${new Date().toISOString()}] ${phase}\n`);
};
