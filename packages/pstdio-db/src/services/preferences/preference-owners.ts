import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { projects, sessions, workspaces } from "../../db/schemas.pg";
import { getExtensionStorageOwner } from "../extension-storage/storage-owner";

export type ExtensionSettingOwnerType = "installed_extension" | "extension_instance" | "device_extension";
export interface ExtensionSettingOwner {
  owner_type: ExtensionSettingOwnerType;
  owner_id: string;
  extension_id: string;
}
const settingScopes = {
  installed_extension: "global",
  extension_instance: "project",
  device_extension: "user",
} as const;
export const extensionSettingPreferenceOwner = (owner: ExtensionSettingOwner) => ({
  scope: settingScopes[owner.owner_type],
  scope_id: owner.owner_id,
  extension_id: owner.extension_id,
});
export interface WebviewPreferenceKey {
  extension_id: string;
  name: string;
  scope_type: string;
  scope_id: string;
}
export const webviewPreferenceKey = (key: WebviewPreferenceKey) => ({
  scope: key.scope_type as "global" | "user" | "project" | "workspace" | "session" | "resource",
  scope_id: key.scope_id,
  extension_id: key.extension_id,
  key: `webview:${key.name}`,
});

export const preferenceProjectId = async (db: Pick<DbClient, "select">, scope: string, id: string) => {
  if (scope === "project") {
    const [row] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id));
    return row?.id ?? null;
  }
  if (scope === "workspace" || scope === "session") {
    const table = scope === "workspace" ? workspaces : sessions;
    const [row] = await db.select({ id: table.project_id }).from(table).where(eq(table.id, id));
    return row?.id ?? null;
  }
  return null;
};

export const instancePreferenceOwner = async (db: Pick<DbClient, "select">, projectId: string, instanceId: string) => {
  const owner = await getExtensionStorageOwner(db, instanceId);
  if (!owner || owner.workbenchId !== projectId) throw new Error("Extension instance not found in project");
  return { scope: "project" as const, scope_id: instanceId, extension_id: owner.extensionId };
};
