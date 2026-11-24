import { parseArgs } from "node:util";
import { z } from "zod";
import { setAccountFeatureByEmail, setAccountFeatureInTransaction } from "../src/account-features";
import { connectManager } from "../src/database";
import { withAccountTransaction } from "../src/transactions";

export const runAccountFeature = async (args: string[], databaseUrl: string) => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      email: { type: "string" },
      account: { type: "string" },
      feature: { type: "string" },
    },
  });
  const action = z.enum(["grant", "revoke"]).parse(positionals.length === 1 ? positionals[0] : undefined);
  const selector = z
    .union([
      z.strictObject({ email: z.email(), account: z.undefined().optional() }),
      z.strictObject({ account: z.string().min(1), email: z.undefined().optional() }),
    ])
    .parse({ email: values.email, account: values.account });
  const feature = z.enum(["relay"]).parse(values.feature);
  const connection = connectManager(databaseUrl);
  try {
    const enabled = action === "grant";
    if (selector.email)
      return await setAccountFeatureByEmail(connection.db, { email: selector.email, feature, enabled });
    const accountId = selector.account!;
    await withAccountTransaction(connection.db, accountId, (transaction) =>
      setAccountFeatureInTransaction(transaction, { accountId, feature, enabled }),
    );
    return { accountId, feature, enabled };
  } finally {
    await connection.close();
  }
};

if (import.meta.main) {
  try {
    console.log(JSON.stringify(await runAccountFeature(process.argv.slice(2), process.env.DATABASE_URL ?? "")));
  } catch (error) {
    let message = error instanceof Error ? error.message : "Feature update failed";
    if (error instanceof z.ZodError)
      message = "Usage: account-feature <grant|revoke> (--email <email> | --account <id>) --feature relay";
    console.error(message);
    process.exitCode = 1;
  }
}
