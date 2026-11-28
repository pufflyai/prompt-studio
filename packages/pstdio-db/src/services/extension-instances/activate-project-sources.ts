import { and, eq, inArray } from "drizzle-orm";
import { canonicalExtensionId, historicalExtensionId } from "pstdio-api-contracts/extension-host";
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
export const matchingExtensionIds = (extensionId: string) => [
  canonicalExtensionId(extensionId),
  historicalExtensionId(extensionId),
];

export const findProjectExtension = async (db: Pick<DbClient, "select">, projectId: string, extensionId: string) => {
  const [row] = await db
    .select({ instance: project_extensions })
    .from(project_extensions)
    .innerJoin(installed_extension_sources, eq(project_extensions.extension_ref, installed_extension_sources.id))
    .where(
      and(
        eq(project_extensions.project_id, projectId),
        inArray(installed_extension_sources.extension_id, matchingExtensionIds(extensionId)),
      ),
    );
  return row ? projectExtensionRow(row.instance) : null;
};

const assertExpectedProvider = async (tx: Tx, input: ActivationInput) => {
  const selected = await findProjectExtension(tx, input.projectId, input.extensionId);
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
        inArray(installed_extension_sources.extension_id, matchingExtensionIds(input.extensionId)),
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
  const current = projectExtensionRow(instance);
  if (previous && previous.id !== current.id)
    await rekeyInstancePreferences(tx, input.projectId, previous.id, current.id);
  return {
    instance: current,
    changed: [current],
    removed: previous && previous.id !== current.id ? [previous] : [],
  };
};
export const activateProjectSources = (db: DbClient, inputs: ActivationInput[]) =>
  db.transaction(async (tx) => {
    const results = [];
    for (const input of inputs) results.push(await activateSource(tx, input));
    return results;
  });
