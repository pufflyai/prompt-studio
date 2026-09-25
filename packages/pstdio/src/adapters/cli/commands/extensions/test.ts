import type { Argv } from "yargs";
import { formatSmokeResult } from "@/features/extensions/smoke-result";

export const command = "test <source>";
export const describe = "Run isolated initial-load extension smoke checks in Chromium";
export const builder = (yargs: Argv) =>
  yargs
    .positional("source", { type: "string", demandOption: true, describe: "Local extension directory" })
    .option("project-path", {
      type: "string",
      describe: "Fixture context containing source and local dependencies; copied before use",
    })
    .option("json", { type: "boolean", default: false, describe: "Write one JSON result to stdout" })
    .option("keep-home", {
      type: "boolean",
      default: false,
      describe: "Retain disposable inputs, home and evidence after stopping processes",
    });

export const handler = async (argv: { source: string; projectPath?: string; json?: boolean; keepHome?: boolean }) => {
  const controller = new AbortController();
  let interrupted: NodeJS.Signals | undefined;
  const interrupt = (signal: NodeJS.Signals) => {
    interrupted = signal;
    controller.abort(new Error(`Interrupted by ${signal}`));
  };
  const sigint = () => interrupt("SIGINT");
  const sigterm = () => interrupt("SIGTERM");
  process.once("SIGINT", sigint);
  process.once("SIGTERM", sigterm);
  try {
    const { runExtensionSmoke } = await import("@/features/extensions/smoke-runner");
    const result = await runExtensionSmoke({ ...argv, signal: controller.signal });
    console.log(argv.json ? JSON.stringify(result) : formatSmokeResult(result));
    process.exitCode = result.exitCode;
  } catch (error) {
    if (!interrupted) throw error;
  } finally {
    process.off("SIGINT", sigint);
    process.off("SIGTERM", sigterm);
    if (interrupted) process.kill(process.pid, interrupted);
  }
};
