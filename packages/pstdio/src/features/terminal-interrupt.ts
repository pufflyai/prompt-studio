// Isolated Windows console fallback; see ADR 0118. Callers retain normal signal handling.
export const onTerminalInterrupt = (interrupt: () => void) => {
  const input = process.stdin;
  if (!input.isTTY) return () => {};
  const raw = input.isRaw;
  const flowing = input.readableFlowing;
  const onData = (data: Buffer) => {
    if (data.includes(3)) interrupt();
  };
  input.setRawMode(true);
  input.on("data", onData);
  input.resume();
  return () => {
    input.off("data", onData);
    input.setRawMode(raw);
    if (flowing !== true) input.pause();
  };
};
