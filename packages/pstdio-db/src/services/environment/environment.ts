import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { local_environment } from "../../db/schemas/environment";

export const createEnvironmentDBService = (db: DbClient) => {
  let environment: Promise<{ environmentId: string }> | undefined;
  const load = async () => {
    await db
      .insert(local_environment)
      .values({ id: "local", environment_id: crypto.randomUUID() })
      .onConflictDoNothing();
    const [owner] = await db.select().from(local_environment).where(eq(local_environment.id, "local"));
    return { environmentId: owner!.environment_id };
  };
  return {
    get: () =>
      (environment ??= load().catch((error) => {
        environment = undefined;
        throw error;
      })),
  };
};
