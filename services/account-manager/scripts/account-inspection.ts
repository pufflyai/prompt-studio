import { parseArgs } from "node:util";
import { z } from "zod";
import { findAccountIdByEmail } from "../src/account-features";
import { inspectManagerAccount } from "../src/account-inspection";
import { connectManager } from "../src/database";

/** Read-only operator report of one account, named by its ID or its verified Google email. */
export const runAccountInspection = async (args: string[], databaseUrl: string) => {
  const { values } = parseArgs({ args, options: { account: { type: "string" }, email: { type: "string" } } });
  if (!values.account === !values.email) throw new z.ZodError([]);
  const connection = connectManager(databaseUrl);
  try {
    const accountId = values.account ?? (await findAccountIdByEmail(connection.db, values.email!));
    return await inspectManagerAccount(connection.db, accountId);
  } finally {
    await connection.close();
  }
};

if (import.meta.main) {
  try {
    console.log(
      JSON.stringify(await runAccountInspection(process.argv.slice(2), process.env.DATABASE_URL ?? ""), null, 2),
    );
  } catch (error) {
    let message = error instanceof Error ? error.message : "Inspection failed";
    if (error instanceof z.ZodError) message = "Usage: account-inspection (--account <account id> | --email <email>)";
    console.error(message);
    process.exitCode = 1;
  }
}
