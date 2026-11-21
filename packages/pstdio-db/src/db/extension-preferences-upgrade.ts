import { createReadStream } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { sql } from "drizzle-orm";
import { projectExtensionId } from "../services/extension-instances/project-extension-row";
import {
  extensionSettingPreferenceOwner,
  preferenceProjectId,
  webviewPreferenceKey,
} from "../services/preferences/preference-owners";
import type { DbClient } from "./connection.pglite";
import { flushDirectory } from "./pglite-home-recovery";
import { preferences } from "./schemas/preferences";
import { readUpgradeRows } from "./upgrade-rows";

type Preference = typeof preferences.$inferInsert;
type Legacy = Record<string, unknown>;
type LegacySetting = Legacy &
  Parameters<typeof extensionSettingPreferenceOwner>[0] & {
    key: string;
    value_json: unknown;
    created_at: string;
    updated_at: string;
  };
type LegacyWebview = Legacy & Parameters<typeof webviewPreferenceKey>[0] & { value_json: unknown; updated_at: string };
interface LegacyInstancePreference extends Record<string, unknown> {
  project_id: string;
  extension_instance_id: string;
  updated_at: string;
  skill_key?: string;
  automation_id?: string;
}
const sources = [
  { table: "extension_settings", keys: ["owner_type", "owner_id", "extension_id", "key"] },
  { table: "extension_skill_preferences", keys: ["project_id", "extension_instance_id", "skill_key"] },
  { table: "extension_automation_preferences", keys: ["project_id", "extension_instance_id", "automation_id"] },
  { table: "webview_preferences", keys: ["extension_id", "name", "scope_type", "scope_id"] },
] as const;

const legacyInstance = async (db: DbClient, id: string) => {
  const {
    rows: [row],
  } = await db.execute<{ extension_id: string; installed_extension_id: string; project_id: string | null }>(sql`
    SELECT s.extension_id, i.installed_extension_id, p.id AS project_id FROM extension_instances i
    JOIN installed_extension_sources s ON s.id = i.installed_extension_id
    LEFT JOIN projects p ON p.id = i.scope_id AND i.scope_type = 'project' WHERE i.id = ${id}
  `);
  if (!row) return null;
  return { ...row, id: row.project_id ? projectExtensionId(row.project_id, row.installed_extension_id) : id };
};
const convert = async (db: DbClient, table: string, input: Legacy) => {
  if (table === "webview_preferences") {
    const row = input as LegacyWebview;
    let sync: Preference["sync"] = "device";
    if (row.scope_type === "user") sync = "personal";
    if (row.scope_type === "project") sync = "team";
    return {
      ...webviewPreferenceKey(row),
      sync,
      value: row.value_json,
      updated_at: row.updated_at,
      project_id: await preferenceProjectId(db, row.scope_type, row.scope_id),
    };
  }
  if (table === "extension_settings") {
    const row = input as LegacySetting;
    const instance = row.owner_type === "extension_instance" ? await legacyInstance(db, row.owner_id) : null;
    const known = ["installed_extension", "extension_instance", "device_extension"].includes(row.owner_type);
    const owner = known
      ? extensionSettingPreferenceOwner({ ...row, owner_id: instance?.id ?? row.owner_id })
      : {
          scope: "resource" as const,
          scope_id: JSON.stringify(["setting-owner", row.owner_type, row.owner_id]),
          extension_id: row.extension_id,
        };
    const projectId = instance?.project_id ?? null;
    let sync: Preference["sync"] = "device";
    if (row.owner_type === "installed_extension") sync = "personal";
    if (row.owner_type === "extension_instance") sync = "team";
    return {
      ...owner,
      key: `setting:${row.key}`,
      project_id: projectId,
      sync,
      value: { value: row.value_json, created_at: row.created_at },
      updated_at: row.updated_at,
    };
  }
  const row = input as LegacyInstancePreference;
  const instance = await legacyInstance(db, row.extension_instance_id);
  if (!instance || instance.project_id !== row.project_id)
    throw new Error(`Cannot resolve extension preference owner ${row.extension_instance_id}`);
  const { project_id, extension_instance_id: _instanceId, skill_key, automation_id, updated_at, ...value } = row;
  return {
    scope: "project" as const,
    scope_id: instance.id,
    extension_id: instance.extension_id,
    project_id,
    key: table === "extension_skill_preferences" ? `skill:${skill_key}` : `automation:${automation_id}`,
    sync: "team" as const,
    value,
    updated_at,
  };
};

async function* savedPreferences(path: string) {
  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    for await (const line of lines) if (line) yield JSON.parse(line) as Preference;
  } finally {
    lines.close();
    stream.destroy();
  }
}

async function* convertedPreferences(db: DbClient, existing: Set<string>) {
  for (const source of sources) {
    if (!existing.has(source.table)) continue;
    for await (const row of readUpgradeRows(db, source)) yield await convert(db, source.table, row);
  }
}

const capturePreferences = async (db: DbClient, snapshot: string | undefined) => {
  const { rows: tables } = await db.execute<{ table_name: string }>(sql`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    AND table_name IN ('extension_settings', 'extension_skill_preferences', 'extension_automation_preferences', 'webview_preferences')
  `);
  if (!tables.length) return;
  const rows = convertedPreferences(db, new Set(tables.map((row) => row.table_name)));
  const memory: Preference[] = [];
  if (!snapshot) {
    for await (const row of rows) memory.push(row);
    return memory;
  }
  const temporary = `${snapshot}.tmp`;
  const file = await open(temporary, "w", 0o600);
  try {
    for await (const row of rows) await file.writeFile(`${JSON.stringify(row)}\n`);
    await file.sync();
  } catch (error) {
    await file.close();
    await rm(temporary, { force: true });
    throw error;
  } finally {
    await file.close();
  }
  await rename(temporary, snapshot);
  await flushDirectory(dirname(snapshot));
  return memory;
};

const hasSnapshot = async (path: string) => {
  try {
    const file = await open(path, "r");
    await file.close();
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return false;
  }
};

const restorePreferences = async (db: DbClient, rows: AsyncIterable<Preference> | Iterable<Preference>) => {
  let batch: Preference[] = [];
  let bytes = 0;
  const flush = async () => {
    if (!batch.length) return;
    await db.insert(preferences).values(batch).onConflictDoNothing();
    batch = [];
    bytes = 0;
  };
  for await (const row of rows) {
    const size = Buffer.byteLength(JSON.stringify(row));
    if (batch.length >= 200 || bytes + size > 4 * 1024 * 1024) await flush();
    batch.push(row);
    bytes += size;
  }
  await flush();
};

// Capture bounded pages before the generated migration drops the old tables. The complete,
// fsynced JSONL is retained until every converted row commits; replay after a crash is idempotent.
export const prepareExtensionPreferencesUpgrade = async (db: DbClient, path: string) => {
  const snapshot = path === ":memory:" ? undefined : `${path}-extension-preferences-upgrade.jsonl`;
  let memory: Preference[] = [];
  if (!snapshot || !(await hasSnapshot(snapshot))) {
    const captured = await capturePreferences(db, snapshot);
    if (!captured) return;
    memory = captured;
  }
  return async () => {
    await restorePreferences(db, snapshot ? savedPreferences(snapshot) : memory);
    if (snapshot) {
      await rm(snapshot);
      await flushDirectory(dirname(snapshot));
    }
  };
};
