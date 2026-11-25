import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { installed_extension_sources, project_extensions } from "../../db/schemas.pg";
import { rekeyInstancePreferences } from "../extension-preferences/instance-preferences";
import { projectExtensionRow, projectExtensionWhere } from "./project-extension-row";

type Tx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export type ActivationInput = {
  projectId: string;
  extensionId: string;
  instanceId?: string;
  installedSourceId: string;
  expectedSourceId?: string;
  enabled?: boolean;
};
const assertExpectedProvider = async (tx: Tx, input: ActivationInput) => {
  const candidates = await tx
    .select({ instance: project_extensions })
    .from(project_extensions)
    .innerJoin(installed_extension_sources, eq(project_extensions.extension_ref, installed_extension_sources.id))
    .where(
      and(
        eq(project_extensions.project_id, input.projectId),
        eq(installed_extension_sources.extension_id, input.extensionId),
      ),
    );
  const rows = candidates.map(({ instance }) => projectExtensionRow(instance));
  const selected =
    rows.find((row) => row.enabled) ??
    rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.created_at.localeCompare(a.created_at))[0];
  if (selected?.id !== input.instanceId) throw new Error("Project extension changed during activation; retry");
  return selected;
};
const activateSource = async (tx: Tx, input: ActivationInput) => {
  const previous = await assertExpectedProvider(tx, input);
  const [source] = await tx
    .select({ id: installed_extension_sources.id })
    .from(installed_extension_sources)
    .where(
      and(
        eq(installed_extension_sources.id, input.installedSourceId),
        eq(installed_extension_sources.extension_id, input.extensionId),
      ),
    );
  if (!source) throw new Error("Project extension source identity does not match.");
  const timestamp = new Date().toISOString();
  let instance: typeof project_extensions.$inferSelect;
  if (input.instanceId) {
    const [updated] = await tx
      .update(project_extensions)
      .set({
        extension_ref: input.installedSourceId,
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        updated_at: timestamp,
      })
      .where(
        and(
          projectExtensionWhere(input.instanceId),
          eq(project_extensions.project_id, input.projectId),
          input.expectedSourceId ? eq(project_extensions.extension_ref, input.expectedSourceId) : undefined,
        ),
      )
      .returning();
    if (!updated) throw new Error("Project extension instance not found");
    instance = updated;
  } else {
    const [created] = await tx
      .insert(project_extensions)
      .values({
        project_id: input.projectId,
        extension_ref: input.installedSourceId,
        enabled: input.enabled ?? true,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning();
    instance = created!;
  }
  const sources = tx
    .select({ id: installed_extension_sources.id })
    .from(installed_extension_sources)
    .where(eq(installed_extension_sources.extension_id, input.extensionId));
  const changed = instance.enabled
    ? await tx
        .update(project_extensions)
        .set({
          enabled: sql`case when ${project_extensions.extension_ref} = ${instance.extension_ref} then true else false end`,
          updated_at: timestamp,
        })
        .where(
          and(eq(project_extensions.project_id, input.projectId), inArray(project_extensions.extension_ref, sources)),
        )
        .returning()
    : [instance];
  const current = projectExtensionRow(instance);
  if (previous && previous.id !== current.id)
    await rekeyInstancePreferences(tx, input.projectId, previous.id, current.id);
  return {
    instance: projectExtensionRow(changed.find((row) => row.extension_ref === instance.extension_ref)!),
    changed: changed.map(projectExtensionRow),
    removed: previous && previous.id !== current.id ? [previous] : [],
  };
};
export const activateProjectSources = (db: DbClient, inputs: ActivationInput[]) =>
  db.transaction(async (tx) => {
    const results = [];
    for (const input of inputs) results.push(await activateSource(tx, input));
    return results;
  });
