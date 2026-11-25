import { parseArgs } from "node:util";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { setAccountFeature } from "../src/account-features";
import { connectManager } from "../src/database";

export const runAccountFeature = async (args: string[], databaseUrl: string) => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      email: { type: "string" },
      account: { type: "string" },
      "account-id": { type: "string" },
      feature: { type: "string" },
    },
  });
  const action = z.enum(["grant", "revoke"]).parse(positionals.length === 1 ? positionals[0] : undefined);
  const target = z
    .union([
      z.strictObject({ email: z.email() }),
      z.strictObject({ account: identitySchema }).transform(({ account }) => ({ accountId: account })),
      z.strictObject({ "account-id": identitySchema }).transform(({ "account-id": accountId }) => ({ accountId })),
    ])
    .parse({
      ...(values.email !== undefined && { email: values.email }),
      ...(values.account !== undefined && { account: values.account }),
      ...(values["account-id"] !== undefined && { "account-id": values["account-id"] }),
    });
  const feature = z.enum(["relay"]).parse(values.feature);
  const connection = connectManager(databaseUrl);
  try {
    return await setAccountFeature(connection.db, { ...target, feature, enabled: action === "grant" });
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
      message =
        "Usage: account-feature <grant|revoke> (--email <email> | --account <id> | --account-id <id>) --feature relay";
    console.error(message);
    process.exitCode = 1;
  }
}
