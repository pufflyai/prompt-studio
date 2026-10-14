import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { webview_preferences } from "../../db/schemas.pg";

export interface WebviewPreferenceKey {
  extension_id: string;
  name: string;
  scope_type: string;
  scope_id: string;
}

export const createWebviewPreferencesDBService = (db: DbClient) => ({
  async get(key: WebviewPreferenceKey) {
    const [row] = await db
      .select()
      .from(webview_preferences)
      .where(
        and(
          eq(webview_preferences.extension_id, key.extension_id),
          eq(webview_preferences.name, key.name),
          eq(webview_preferences.scope_type, key.scope_type),
          eq(webview_preferences.scope_id, key.scope_id),
        ),
      );
    return row?.value_json;
  },
  async set(input: WebviewPreferenceKey & { value_json: unknown }) {
    const size = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if (size(input.value_json) > 16384) throw new Error("preference_too_large: value exceeds 16 KiB");
    await db.transaction(async (tx) => {
      // Serialize the quota check with writes, including the first value for a new owner.
      await tx.execute(sql`LOCK TABLE webview_preferences IN SHARE ROW EXCLUSIVE MODE`);
      const rows = await tx
        .select()
        .from(webview_preferences)
        .where(eq(webview_preferences.extension_id, input.extension_id));
      const others = rows.filter(
        (row) => row.name !== input.name || row.scope_type !== input.scope_type || row.scope_id !== input.scope_id,
      );
      if (others.reduce((total, row) => total + size(row.value_json), size(input.value_json)) > 262144)
        throw new Error("preference_too_large: extension exceeds 256 KiB");
      await tx
        .insert(webview_preferences)
        .values({ ...input, updated_at: new Date().toISOString() })
        .onConflictDoUpdate({
          target: [
            webview_preferences.extension_id,
            webview_preferences.name,
            webview_preferences.scope_type,
            webview_preferences.scope_id,
          ],
          set: { value_json: input.value_json, updated_at: new Date().toISOString() },
        });
    });
  },
});
