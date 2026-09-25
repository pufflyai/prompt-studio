import { hideBin } from "yargs/helpers";
import { CLI_VERSION } from "./features/cli-version";

const rawArgs = hideBin(process.argv);

// Fast path: answer `--version` without loading the rest of the CLI. Everything
// else lives in `./cli-main`, imported lazily so trivial invocations don't pay
// for the full command graph (see runCli's doc comment).
if (rawArgs[0] === "--extension-smoke-install-worker") {
  const { runSmokeInstallWorker } = await import("./features/extensions/smoke-install-worker");
  await runSmokeInstallWorker(rawArgs.slice(1));
  process.exit(process.exitCode ?? 0);
}

if (rawArgs.length === 1 && (rawArgs[0] === "--version" || rawArgs[0] === "-v")) {
  process.stdout.write(`${CLI_VERSION}\n`);
  process.exit(0);
}

const { runCli } = await import("./cli-main");
await runCli(rawArgs);
