import type { DbClient } from "../../db/connection.pglite";
import { preferences as table } from "../../db/schemas/preferences";
import { createPreferencesDBService } from "../preferences/preferences";

const owner = { scope: "global", scope_id: "global", extension_id: "" } as const;
const defaults = {
  notifications_enabled: false,
  machine_tokens_enabled: false,
  max_concurrent_sessions: null as number | null,
};
type Settings = typeof defaults;

export const createSettingsDBService = (db: DbClient) => {
  const preferences = createPreferencesDBService(db);
  const getStored = async () => {
    const rows = await preferences.list(owner);
    const values = new Map(rows.map((row) => [row.key, row.value]));
    if (!values.has("settings_created_at")) return null;
    const created_at = values.get("settings_created_at") as string;
    const timestamps = rows.filter((row) => row.key in defaults).map((row) => row.updated_at);
    return {
      id: "global",
      created_at,
      updated_at: timestamps.sort().at(-1) ?? created_at,
      notifications_enabled: (values.get("notifications_enabled") ?? false) as boolean,
      machine_tokens_enabled: (values.get("machine_tokens_enabled") ?? false) as boolean,
      max_concurrent_sessions: (values.get("max_concurrent_sessions") ?? null) as number | null,
    };
  };
  const get = async () => {
    const stamp = new Date().toISOString();
    // Creation time is part of the existing settings sync row and cannot be derived from later edits.
    await db
      .insert(table)
      .values({
        ...owner,
        key: "settings_created_at",
        value: stamp,
        sync: "device",
        updated_at: stamp,
      })
      .onConflictDoNothing();
    return (await getStored())!;
  };
  const update = async (input: Partial<Settings>) => {
    await get();
    await db.transaction(async (tx) => {
      const store = createPreferencesDBService(tx);
      for (const key of Object.keys(defaults) as (keyof Settings)[]) {
        if (input[key] === undefined) continue;
        await store.set({ ...owner, key, value: input[key], sync: "device" });
      }
    });
    return get();
  };
  return { get, getStored, update };
};
