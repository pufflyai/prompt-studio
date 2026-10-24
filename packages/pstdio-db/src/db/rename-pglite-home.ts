import { rename } from "node:fs/promises";

export const renamePgliteHome = async (source: string, target: string, _signal?: AbortSignal) => {
  await rename(source, target);
};
