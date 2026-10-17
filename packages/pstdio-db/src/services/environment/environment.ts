import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { local_environment } from "../../db/schemas/environment";

export const createEnvironmentDBService = (db: DbClient) => ({
  get: async () => {
    await db
      .insert(local_environment)
      .values({ id: "local", environment_id: crypto.randomUUID() })
      .onConflictDoNothing();
    const [owner] = await db.select().from(local_environment).where(eq(local_environment.id, "local"));
    return { environmentId: owner!.environment_id };
  },
});
