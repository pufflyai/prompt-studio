import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { preferences } from "../../db/schemas/preferences";
import { preferenceProjectId, type WebviewPreferenceKey, webviewPreferenceKey } from "../preferences/preference-owners";
import { preferenceOwnerWhere } from "../preferences/preferences";

export type { WebviewPreferenceKey } from "../preferences/preference-owners";

const whereKey = (key: WebviewPreferenceKey) =>
  and(preferenceOwnerWhere(webviewPreferenceKey(key)), eq(preferences.key, `webview:${key.name}`));
export const createWebviewPreferencesDBService = (db: DbClient) => ({
  async get(key: WebviewPreferenceKey) {
    const [row] = await db.select().from(preferences).where(whereKey(key));
    return row?.value;
  },
  async set(input: WebviewPreferenceKey & { value_json: unknown }) {
    const size = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if (size(input.value_json) > 16384) throw new Error("preference_too_large: value exceeds 16 KiB");
    await db.transaction(async (tx) => {
      await tx.execute(sql`LOCK TABLE preferences IN SHARE ROW EXCLUSIVE MODE`);
      const rows = await tx
        .select()
        .from(preferences)
        .where(and(eq(preferences.extension_id, input.extension_id), sql`starts_with(${preferences.key}, 'webview:')`));
      const key = webviewPreferenceKey(input);
      const others = rows.filter(
        (row) => row.key !== key.key || row.scope !== key.scope || row.scope_id !== key.scope_id,
      );
      if (others.reduce((total, row) => total + size(row.value), size(input.value_json)) > 262144)
        throw new Error("preference_too_large: extension exceeds 256 KiB");
      let sync: "team" | "personal" | "device" = "device";
      if (key.scope === "user") sync = "personal";
      if (key.scope === "project") sync = "team";
      await tx
        .insert(preferences)
        .values({
          ...key,
          value: input.value_json,
          project_id: await preferenceProjectId(tx, key.scope, key.scope_id),
          sync,
          updated_at: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [preferences.scope, preferences.scope_id, preferences.extension_id, preferences.key],
          set: { value: input.value_json, updated_at: new Date().toISOString() },
        });
    });
  },
});
