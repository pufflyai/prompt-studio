import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { local_environment } from "../../db/schemas/environment";

export const createEnvironmentDBService = (db: DbClient, expectedEnvironmentId?: string) => {
  let environment: Promise<{ environmentId: string }> | undefined;
  const load = async () => {
    await db
      .insert(local_environment)
      .values({ id: "local", environment_id: expectedEnvironmentId ?? crypto.randomUUID() })
      .onConflictDoNothing();
    const [owner] = await db.select().from(local_environment).where(eq(local_environment.id, "local"));
    if (expectedEnvironmentId && owner!.environment_id !== expectedEnvironmentId)
      throw new Error("This runtime home belongs to another device");
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
