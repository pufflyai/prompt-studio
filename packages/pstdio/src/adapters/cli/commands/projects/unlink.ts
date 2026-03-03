import { findGitRoot, removeConfig } from "@/features/config/config";

export const command = "unlink";
export const describe = "Unlink the current repo from its project";

export const handler = () => {
  const root = findGitRoot(process.cwd());
  if (!root) {
    throw new Error("Not inside a git repository.");
  }

  const removed = removeConfig(root);
  if (!removed) {
    throw new Error("No project linked. Nothing to unlink.");
  }

  console.log(`Unlinked project at ${root}`);
};
