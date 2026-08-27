import type { Arguments, Argv } from "yargs";
import { createConnectionsClient } from "./client";

export const command = "check";
export const describe = "Check a configured extension connection";
export const builder = (yargs: Argv) =>
  yargs
    .option("project", { type: "string", demandOption: true, describe: "Exact project ID" })
    .option("extension", { type: "string", demandOption: true, describe: "Extension ID" })
    .option("connection", { type: "string", demandOption: true, describe: "Connection contribution ID" });

export const createHandler = (client = createConnectionsClient()) =>
  async function checkConnection(argv: Arguments<{ project: string; extension: string; connection: string }>) {
    const result = await client.checkConnection(argv.project, argv.extension, argv.connection);
    console.log(JSON.stringify(result, null, 2));
  };

export const handler = createHandler();
