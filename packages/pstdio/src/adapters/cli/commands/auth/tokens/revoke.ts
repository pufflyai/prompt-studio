import type { Arguments, Argv } from "yargs";
import { createTokenClient } from "./client";

export const command = "revoke";
export const describe = "Revoke a machine token";
export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Machine token ID" });

export const createHandler = (client = createTokenClient()) =>
  async function revokeToken(argv: Arguments<{ id: string }>) {
    await client.revokeToken(argv.id);
    console.log(`Revoked machine token ${argv.id}.`);
  };

export const handler = createHandler();
