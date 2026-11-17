import { parseArgs } from "node:util";
import { z } from "zod";
import { readRelayLimits } from "../src/limits";
import { inspectRelayAccount } from "../src/storage/account-inspection";
import { connectRelay } from "../src/storage/database";

/** Read-only operator report of what one account stores on the relay. See `inspectRelayAccount`. */
export const runRelayInspection = async (
  args: string[],
  databaseUrl: string,
  env: Record<string, string | undefined> = {},
) => {
  const { values } = parseArgs({
    args,
    options: { account: { type: "string" }, project: { type: "string", multiple: true } },
  });
  const accountId = z.string().min(1).parse(values.account);
  const connection = connectRelay(databaseUrl);
  try {
    return await inspectRelayAccount(connection.db, {
      accountId,
      projectIds: values.project ?? [],
      gracePeriodMs: readRelayLimits(env).gracePeriodMs,
    });
  } finally {
    await connection.close();
  }
};

if (import.meta.main) {
  try {
    const report = await runRelayInspection(process.argv.slice(2), process.env.DATABASE_URL ?? "", process.env);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    let message = error instanceof Error ? error.message : "Inspection failed";
    if (error instanceof z.ZodError) message = "Usage: account-inspection --account <account id> [--project <id>]...";
    console.error(message);
    process.exitCode = 1;
  }
}
