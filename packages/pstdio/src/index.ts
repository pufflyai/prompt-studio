import { hideBin } from "yargs/helpers";
import { bindCliOutput } from "./features/cli-output";
import { CLI_VERSION } from "./features/cli-version";

const rawArgs = hideBin(process.argv);

if (rawArgs.length === 1 && rawArgs[0] === "--pstdio-extension-owner") {
  const { runExtensionOwner } = await import("pstdio-extensions");
  runExtensionOwner();
} else if (rawArgs.length === 1 && rawArgs[0] === "--pstdio-extension-preparation") {
  const { runExtensionPreparation } = await import("pstdio-extensions");
  runExtensionPreparation();
} else {
  // Fast path: answer `--version` without loading the rest of the CLI. Everything
  // else lives in `./cli-main`, imported lazily so trivial invocations don't pay
  // for the full command graph (see runCli's doc comment).

  if (rawArgs.length === 1 && (rawArgs[0] === "--version" || rawArgs[0] === "-v")) {
    process.stdout.write(`${CLI_VERSION}\n`);
    process.exit(0);
  }

  // Bind before importing commands: their defaults capture `console.log` when they load.
  const { exit } = bindCliOutput();
  const { runCli } = await import("./cli-main");
  await runCli(rawArgs, exit);
}
