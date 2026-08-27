import type { Arguments, Argv } from "yargs";
import { createTokenClient } from "./client";

export const command = "issue";
export const describe = "Issue a project and command-scoped machine token";

export const builder = (yargs: Argv) =>
  yargs
    .option("name", { type: "string", demandOption: true, describe: "Token owner and purpose" })
    .option("project", { type: "string", demandOption: true, describe: "Exact project ID" })
    .option("principal", { type: "string", describe: "Existing principal ID for token rotation" })
    .option("command", { type: "string", array: true, demandOption: true, describe: "Allowed command ID" })
    .option("expires-in", { type: "string", default: "90d", describe: "Expiry such as 30m, 24h, or 90d" });

export const parseExpirySeconds = (value: string) => {
  const match = value.trim().match(/^(\d+)(m|h|d)$/);
  if (!match) throw new Error("Expiry must use minutes, hours, or days, for example 30m, 24h, or 90d.");
  const amount = Number(match[1]);
  const factors = { m: 60, h: 3600, d: 86400 };
  const factor = factors[match[2] as keyof typeof factors];
  return amount * factor;
};

export const createHandler = (client = createTokenClient()) =>
  async function issueToken(
    argv: Arguments<{ name: string; project: string; principal?: string; command: string[]; expiresIn: string }>,
  ) {
    const issued = await client.issueToken({
      name: argv.name,
      projectId: argv.project,
      ...(argv.principal ? { principalId: argv.principal } : {}),
      commandScopes: argv.command,
      expiresInSeconds: parseExpirySeconds(argv.expiresIn),
    });
    console.log(JSON.stringify(issued, null, 2));
  };

export const handler = createHandler();
