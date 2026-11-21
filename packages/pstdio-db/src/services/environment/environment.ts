import type { DbClient } from "../../db/connection.pglite";
import { preferences } from "../../db/schemas/preferences";
import { createPreferencesDBService } from "../preferences/preferences";

const key = { scope: "global", scope_id: "global", extension_id: "", key: "environment_id" } as const;

export const createEnvironmentDBService = (db: DbClient) => {
  let environment: Promise<{ environmentId: string }> | undefined;
  const load = async () => {
    await db
      .insert(preferences)
      .values({
        ...key,
        sync: "device",
        value: crypto.randomUUID(),
        updated_at: new Date().toISOString(),
      })
      .onConflictDoNothing();
    const owner = await createPreferencesDBService(db).get(key);
    return { environmentId: owner!.value as string };
  };
  return {
    get: () =>
      (environment ??= load().catch((error) => {
        environment = undefined;
        throw error;
      })),
  };
};
