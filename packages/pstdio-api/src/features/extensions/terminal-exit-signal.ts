import { constants } from "node:os";

export const terminalExitSignal = (signal: NodeJS.Signals | number | null) => {
  if (typeof signal !== "number") return signal;
  return Object.entries(constants.signals).find(([, number]) => number === signal)?.[0] ?? String(signal);
};
