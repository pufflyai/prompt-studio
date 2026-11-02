import type { Arguments, Argv } from "yargs";
import { forkSession as defaultForkSession } from "@/features/sessions/api/fork-session";

export const command = "fork";
export const describe = "Fork a conversation into an independent session";
export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Source session ID" });

export const createHandler =
  (deps = { forkSession: defaultForkSession, log: console.log }) =>
  async (argv: Arguments<{ id: string }>) => {
    deps.log(JSON.stringify(await deps.forkSession(argv.id)));
  };
export const handler = createHandler();
