import { parseArgs } from "node:util";
import { z } from "zod";
import { setAccountFeatureByEmail } from "../src/account-features";
import { connectManager } from "../src/database";

export const runAccountFeature = async (args: string[], databaseUrl: string) => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      email: { type: "string" },
      feature: { type: "string" },
    },
  });
  const action = z.enum(["grant", "revoke"]).parse(positionals.length === 1 ? positionals[0] : undefined);
  const email = z.email().parse(values.email);
  const feature = z.enum(["relay"]).parse(values.feature);
  const connection = connectManager(databaseUrl);
  try {
    return await setAccountFeatureByEmail(connection.db, { email, feature, enabled: action === "grant" });
  } finally {
    await connection.close();
  }
};

if (import.meta.main) {
  try {
    console.log(JSON.stringify(await runAccountFeature(process.argv.slice(2), process.env.DATABASE_URL ?? "")));
  } catch (error) {
    let message = error instanceof Error ? error.message : "Feature update failed";
    if (error instanceof z.ZodError) message = "Usage: account-feature <grant|revoke> --email <email> --feature relay";
    console.error(message);
    process.exitCode = 1;
  }
}
