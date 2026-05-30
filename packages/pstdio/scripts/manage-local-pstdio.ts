import { resolve } from "node:path";
import { installLocalPstdio, removeLocalPstdio, resolveLocalPstdioInstallDir } from "./local-pstdio-install";

const usage = `Usage:
  bun run pstdio:local:add [--install-dir /path] [--dev-server] [--api-url http://localhost:19841]
  bun run pstdio:local:remove [--install-dir /path]`;

const parseFlagValue = (args: string[], flag: string) => {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === flag) return args[index + 1];
    if (arg.startsWith(`${flag}=`)) return arg.slice(`${flag}=`.length);
  }

  return undefined;
};

const hasFlag = (args: string[], flag: string) => args.includes(flag);

const repoRoot = resolve(import.meta.dir, "../../..");
const [command, ...rest] = process.argv.slice(2);
const installDir = parseFlagValue(rest, "--install-dir") ?? resolveLocalPstdioInstallDir(process.env.PATH);
const apiUrl = parseFlagValue(rest, "--api-url") ?? "http://localhost:19841";
const isDevServerMode = hasFlag(rest, "--dev-server");

try {
  if (command === "add") {
    const result = installLocalPstdio({
      installDir,
      mode: isDevServerMode
        ? {
            apiUrl,
            type: "dev-server",
          }
        : {
            type: "checkout",
          },
      pathEnv: process.env.PATH,
      repoRoot,
    });

    if (!result.previousRepoRoot) {
      process.stdout.write(`Installed local pstdio wrapper at ${result.destination}\n`);
    } else if (result.previousRepoRoot === repoRoot) {
      process.stdout.write(`Updated local pstdio wrapper at ${result.destination}\n`);
    } else {
      process.stdout.write(`Switched pstdio from ${result.previousRepoRoot} to ${repoRoot}\n`);
    }

    if (result.needsPathUpdate) {
      process.stdout.write(`Add ${installDir} to your PATH to use pstdio globally.\n`);
    }

    if (isDevServerMode) {
      process.stdout.write(`pstdio will target the dev server at ${apiUrl}.\n`);
    }

    process.exit(0);
  }

  if (command === "remove") {
    const result = removeLocalPstdio({ installDir, repoRoot });

    if (result.removed) {
      if ("restoredBackup" in result && result.restoredBackup) {
        process.stdout.write(`Restored original pstdio at ${result.destination}\n`);
      } else {
        process.stdout.write(`Removed local pstdio wrapper from ${result.destination}\n`);
      }
      process.exit(0);
    }

    if (result.reason === "missing") {
      process.stdout.write(`No local pstdio wrapper found at ${result.destination}\n`);
      process.exit(0);
    }

    process.stdout.write(
      `pstdio at ${result.destination} points to ${result.installedRepoRoot}, leaving it in place.\n`,
    );
    process.exit(0);
  }

  process.stderr.write(`${usage}\n`);
  process.exit(1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}
