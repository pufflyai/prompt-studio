import { existsSync, readFileSync } from "node:fs";
import { resolveDefaultLogPath } from "pstdio-logging";
import type { Arguments, Argv } from "yargs";

export const command = "logs";
export const describe = "Show pstdio runtime logs";

export const builder = (yargs: Argv) =>
  yargs
    .option("lines", {
      alias: "n",
      default: 100,
      describe: "Number of log lines to show",
      type: "number",
    })
    .option("path", {
      describe: "Print the resolved log file path",
      type: "boolean",
    });

type Args = {
  lines?: number;
  path?: boolean;
};

type Deps = {
  exists: (path: string) => boolean;
  log: (message: string) => void;
  readText: (path: string) => string;
  resolveLogPath: () => string;
};

const defaultDeps: Deps = {
  exists: existsSync,
  log: console.log,
  readText: (path) => readFileSync(path, "utf8"),
  resolveLogPath: resolveDefaultLogPath,
};

const tailText = (content: string, lineCount: number) => {
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines.slice(-Math.max(1, lineCount)).join("\n");
};

export const createHandler =
  (deps: Partial<Deps> = {}) =>
  async (argv: Arguments<Args>) => {
    const resolvedDeps = { ...defaultDeps, ...deps };
    const logPath = resolvedDeps.resolveLogPath();

    if (argv.path) {
      resolvedDeps.log(logPath);
      return;
    }

    if (!resolvedDeps.exists(logPath)) {
      throw new Error(`No pstdio logs found at ${logPath}`);
    }

    resolvedDeps.log(tailText(resolvedDeps.readText(logPath), argv.lines ?? 100));
  };

export const handler = createHandler();
