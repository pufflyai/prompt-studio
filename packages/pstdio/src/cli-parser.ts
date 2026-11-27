import yargs, { type Argv } from "yargs";
import type { bindCliOutput } from "./features/cli-output";
import { CLI_VERSION } from "./features/cli-version";
import type { createCliCommandTracker } from "./features/logging/cli-command-log";

// yargs keeps parsing after a `fail` handler returns, so usage errors are thrown and reported once.
class UsageError extends Error {
  constructor(
    message: string,
    readonly showHelp: () => void,
  ) {
    super(message);
  }
}

export const createCliParser = (rawArgs: string[]) =>
  yargs(rawArgs)
    .scriptName("pstdio")
    .version(CLI_VERSION)
    .strict()
    .fail((msg, err, yargs) => {
      // A `check` that returns a message passes it as `err` too; treat it as a usage error.
      if (err instanceof Error) throw err;
      throw new UsageError(msg, () => yargs.showHelp("error"));
    });

export const parseCli = async <T>(
  cli: Argv<T>,
  exit: ReturnType<typeof bindCliOutput>["exit"],
  commandTracker?: ReturnType<typeof createCliCommandTracker>,
) => {
  try {
    await cli.parseAsync();
    commandTracker?.logSuccess();
  } catch (error) {
    commandTracker?.logFailure(error);
    if (error instanceof UsageError) {
      console.error(`${error.message}\n`);
      error.showHelp();
      console.error("");
    } else {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    await exit(1);
  }
};
