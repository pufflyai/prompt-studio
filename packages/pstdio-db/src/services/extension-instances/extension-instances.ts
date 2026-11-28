import { and, eq, inArray } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { installed_extension_sources, project_extensions } from "../../db/schemas.pg";
import {
  type ActivationInput,
  activateProjectSources as activateProjectSourcesImpl,
  findProjectExtension,
  matchingExtensionIds,
} from "./activate-project-sources";
import { adoptProjectDefault, hasProjectDefaultChoice, recordProjectDefaultChoice } from "./project-defaults";
import {
  type ExtensionInstanceRow,
  parseProjectExtensionId,
  projectExtensionRow,
  projectExtensionWhere,
} from "./project-extension-row";

export type CreateInstanceInput = {
  installed_extension_id: string;
  scope_type: string;
  scope_id: string;
  display_name_override?: string | null;
  enabled?: boolean;
  config_json?: ExtensionInstanceRow["config_json"];
};
export type UpdateInstanceInput = {
  enabled?: boolean;
  display_name_override?: string | null;
  config_json?: ExtensionInstanceRow["config_json"];
  diagnostics_json?: ExtensionInstanceRow["diagnostics_json"];
};
export const createExtensionInstancesDBService = (db: DbClient) => {
  const list = async (filters?: { scope_type?: string; scope_id?: string; installed_extension_id?: string }) => {
    if (filters?.scope_type && filters.scope_type !== "project") return [];
    const rows = await db
      .select()
      .from(project_extensions)
      .where(
        and(
          filters?.scope_id ? eq(project_extensions.project_id, filters.scope_id) : undefined,
          filters?.installed_extension_id
            ? eq(project_extensions.extension_ref, filters.installed_extension_id)
            : undefined,
        ),
      )
      .orderBy(project_extensions.created_at);
    return rows.map(projectExtensionRow);
  };
  const get = async (id: string) => {
    const [row] = await db.select().from(project_extensions).where(projectExtensionWhere(id));
    return row ? projectExtensionRow(row) : null;
  };
  const findByScopeInstalledSource = async (scopeType: string, scopeId: string, installedExtensionId: string) => {
    if (scopeType !== "project") return null;
    const [row] = await db
      .select()
      .from(project_extensions)
      .where(
        and(eq(project_extensions.project_id, scopeId), eq(project_extensions.extension_ref, installedExtensionId)),
      );
    return row ? projectExtensionRow(row) : null;
  };
  const attach = (input: CreateInstanceInput) =>
    db.transaction(async (tx) => {
      if (input.scope_type !== "project") throw new Error("Extension installations require a project.");
      const [source] = await tx
        .select({ extensionId: installed_extension_sources.extension_id })
        .from(installed_extension_sources)
        .where(eq(installed_extension_sources.id, input.installed_extension_id));
      if (!source) throw new Error("Extension source is unavailable.");
      const existing = await findProjectExtension(tx, input.scope_id, source.extensionId);
      if (existing) {
        return existing.installed_extension_id === input.installed_extension_id
          ? { instance: existing, created: false }
          : null;
      }
      const timestamp = new Date().toISOString();
      const [row] = await tx
        .insert(project_extensions)
        .values({
          project_id: input.scope_id,
          extension_ref: input.installed_extension_id,
          display_name: input.display_name_override ?? null,
          enabled: input.enabled ?? true,
          config_json: input.config_json ?? {},
          created_at: timestamp,
          updated_at: timestamp,
        })
        .returning();
      return { instance: projectExtensionRow(row!), created: true };
    });
  const create = async (input: CreateInstanceInput) => {
    const attached = await attach(input);
    if (!attached?.created) throw new Error("An extension with this ID is already installed in the project.");
    return attached.instance;
  };
  const update = async (id: string, input: UpdateInstanceInput) => {
    const { display_name_override, ...value } = input;
    const [row] = await db
      .update(project_extensions)
      .set({
        ...value,
        ...(display_name_override !== undefined ? { display_name: display_name_override } : {}),
        updated_at: new Date().toISOString(),
      })
      .where(projectExtensionWhere(id))
      .returning();
    return row ? projectExtensionRow(row) : null;
  };
  const claimProjectExtensionProvider = async (input: {
    extensionId: string;
    instanceId: string;
    projectId: string;
  }) => {
    const key = parseProjectExtensionId(input.instanceId);
    if (!key || key.projectId !== input.projectId) throw new Error("Extension provider does not belong to project.");
    const matchingSources = db
      .select({ id: installed_extension_sources.id })
      .from(installed_extension_sources)
      .where(inArray(installed_extension_sources.extension_id, matchingExtensionIds(input.extensionId)));
    const rows = await db
      .update(project_extensions)
      .set({ enabled: true, updated_at: new Date().toISOString() })
      .where(and(projectExtensionWhere(input.instanceId), inArray(project_extensions.extension_ref, matchingSources)))
      .returning();
    return rows.map(projectExtensionRow);
  };
  const remove = async (id: string) => {
    const [row] = await db.delete(project_extensions).where(projectExtensionWhere(id)).returning();
    return row ? projectExtensionRow(row) : null;
  };
  return {
    list,
    get,
    findByScopeInstalledSource,
    create,
    attach,
    update,
    claimProjectExtensionProvider,
    activateProjectSources: (inputs: ActivationInput[]) => activateProjectSourcesImpl(db, inputs),
    adoptProjectDefault: (input: Parameters<typeof adoptProjectDefault>[1]) => adoptProjectDefault(db, input),
    hasProjectDefaultChoice: (projectId: string, extensionId: string) =>
      hasProjectDefaultChoice(db, projectId, extensionId),
    recordProjectDefaultChoice: (projectId: string, extensionId: string) =>
      recordProjectDefaultChoice(db, projectId, extensionId),
    remove,
  };
};
