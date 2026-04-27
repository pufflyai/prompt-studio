import type { Arguments, Argv } from "yargs";
import { stopHarnessSession } from "@/features/harnesses/api/stop-harness-session";

export const command = "stop";
export const describe = "Stop a running harness session";

export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Session ID" });

type StopArgs = {
  id: string;
};

export const handler = async (argv: Arguments<StopArgs>) => {
  const session = await stopHarnessSession(argv.id);
  console.log([`Stopped harness session ${session.id}`, `Status: ${session.status}`].join("\n"));
};
