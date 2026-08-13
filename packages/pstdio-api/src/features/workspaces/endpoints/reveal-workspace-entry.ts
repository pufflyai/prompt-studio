import { spawn } from "node:child_process";
import { dirname } from "node:path";
import type { WorkspaceMountResolvedEntry } from "pstdio-extensions";

interface RevealCommand {
  command: string;
  args: string[];
}

export type RevealCommandRunner = (command: RevealCommand) => Promise<void>;

export const resolveRevealCommand = (
  entry: WorkspaceMountResolvedEntry,
  platform: NodeJS.Platform = process.platform,
): RevealCommand => {
  if (platform === "darwin") return { command: "open", args: ["-R", entry.absolutePath] };
  if (platform === "win32") return { command: "explorer.exe", args: [`/select,${entry.absolutePath}`] };

  const target = entry.type === "directory" ? entry.absolutePath : dirname(entry.absolutePath);
  return { command: "xdg-open", args: [target] };
};

const runRevealCommand: RevealCommandRunner = (input) =>
  new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, { detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });

export const revealWorkspaceEntry = async (
  entry: WorkspaceMountResolvedEntry,
  platform: NodeJS.Platform = process.platform,
  runner: RevealCommandRunner = runRevealCommand,
) => runner(resolveRevealCommand(entry, platform));
