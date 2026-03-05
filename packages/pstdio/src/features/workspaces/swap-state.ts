import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type SwapState = {
  workspace_shorthand: string;
  original_branch: string;
  original_commit: string;
  preview_branch: string;
};

const swapPath = (root: string) => join(root, ".pstdio", "swap.json");

export const readSwapState = (root: string): SwapState | null => {
  const path = swapPath(root);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as SwapState;
};

export const writeSwapState = (root: string, state: SwapState) => {
  writeFileSync(swapPath(root), JSON.stringify(state, null, 2));
};

export const removeSwapState = (root: string) => {
  const path = swapPath(root);
  if (existsSync(path)) unlinkSync(path);
};
