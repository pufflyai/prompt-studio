import type { Arguments, Argv } from "yargs";
import { createTokenClient } from "./client";

export const command = "list";
export const describe = "List machine tokens for a project";
export const builder = (yargs: Argv) =>
  yargs.option("project", { type: "string", demandOption: true, describe: "Exact project ID" });

export const createHandler = (client = createTokenClient()) =>
  async function listTokens(argv: Arguments<{ project: string }>) {
    console.log(JSON.stringify(await client.listTokens(argv.project), null, 2));
  };

export const handler = createHandler();
