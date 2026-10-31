import { hideBin } from "yargs/helpers";
import { bindCliOutput } from "./features/cli-output";
import { CLI_VERSION } from "./features/cli-version";

const rawArgs = hideBin(process.argv);

// Fast path: answer `--version` without loading the rest of the CLI. Everything
// else lives in `./cli-main`, imported lazily so trivial invocations don't pay
// for the full command graph (see runCli's doc comment).

if (rawArgs.length === 1 && (rawArgs[0] === "--version" || rawArgs[0] === "-v")) {
  process.stdout.write(`${CLI_VERSION}\n`);
  process.exit(0);
}

if (rawArgs.length === 1 && rawArgs[0] === "performance-observer") {
  // The desktop's private sampler must answer its first probe without loading
  // commands, the API, and embedded extension assets alongside the starting app.
  const { runProcessObserver } = await import("./features/performance/process-observer");
  await runProcessObserver();
} else {
  // Bind before importing commands: their defaults capture `console.log` when they load.
  const { exit } = bindCliOutput();
  const { runCli } = await import("./cli-main");
  await runCli(rawArgs, exit);
}
