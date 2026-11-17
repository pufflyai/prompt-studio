import { parseArgs } from "node:util";
import { z } from "zod";
import { connectRelay } from "../src/storage/database";
import { clearRelayProject } from "../src/storage/project-clear";

/**
 * Operator clear of one project from the relay. Reports only, unless `--confirm` repeats the project ID.
 * See `clearRelayProject`.
 */
export const runRelayProjectClear = async (args: string[], databaseUrl: string) => {
  const { values } = parseArgs({
    args,
    options: { account: { type: "string" }, project: { type: "string" }, confirm: { type: "string" } },
  });
  const accountId = z.string().min(1).parse(values.account);
  const projectId = z.string().min(1).parse(values.project);
  if (values.confirm !== undefined && values.confirm !== projectId)
    throw new Error("--confirm must repeat the project ID");
  const connection = connectRelay(databaseUrl);
  try {
    return await clearRelayProject(connection.db, { accountId, projectId, execute: values.confirm === projectId });
  } finally {
    await connection.close();
  }
};

if (import.meta.main) {
  try {
    console.log(
      JSON.stringify(await runRelayProjectClear(process.argv.slice(2), process.env.DATABASE_URL ?? ""), null, 2),
    );
  } catch (error) {
    let message = error instanceof Error ? error.message : "Clear failed";
    if (error instanceof z.ZodError)
      message = "Usage: project-clear --account <account id> --project <project id> [--confirm <project id>]";
    console.error(message);
    process.exitCode = 1;
  }
}
