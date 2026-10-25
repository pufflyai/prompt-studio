import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_instances, installed_extension_sources } from "../../db/schemas.pg";

type Tx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type InstanceRow = typeof extension_instances.$inferSelect;
const nowTimestamp = () => new Date().toISOString();
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
    .select({ instance: extension_instances })
    .from(extension_instances)
    .innerJoin(
      installed_extension_sources,
      eq(extension_instances.installed_extension_id, installed_extension_sources.id),
    )
    .where(
      and(
        eq(extension_instances.scope_type, "project"),
        eq(extension_instances.scope_id, input.projectId),
        eq(installed_extension_sources.extension_id, input.extensionId),
      ),
    );
  const rows = candidates.map((row) => row.instance);
  const selected =
    rows.find((row) => row.enabled) ??
    rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.created_at.localeCompare(a.created_at))[0];
  if (selected?.id !== input.instanceId) throw new Error("Project extension changed during activation; retry");
};
const activateSource = async (tx: Tx, input: ActivationInput) => {
  await assertExpectedProvider(tx, input);
  let instance: InstanceRow;
  if (input.instanceId) {
    const [updated] = await tx
      .update(extension_instances)
      .set({
        installed_extension_id: input.installedSourceId,
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        updated_at: nowTimestamp(),
      })
      .where(
        and(
          eq(extension_instances.id, input.instanceId),
          eq(extension_instances.scope_type, "project"),
          eq(extension_instances.scope_id, input.projectId),
          input.expectedSourceId ? eq(extension_instances.installed_extension_id, input.expectedSourceId) : undefined,
        ),
      )
      .returning();
    if (!updated) throw new Error("Project extension instance not found");
    instance = updated;
  } else {
    const timestamp = nowTimestamp();
    const [created] = await tx
      .insert(extension_instances)
      .values({
        id: crypto.randomUUID(),
        installed_extension_id: input.installedSourceId,
        scope_type: "project",
        scope_id: input.projectId,
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
        .update(extension_instances)
        .set({
          enabled: sql`case when ${extension_instances.id} = ${instance.id} then true else false end`,
          updated_at: nowTimestamp(),
        })
        .where(
          and(
            eq(extension_instances.scope_type, "project"),
            eq(extension_instances.scope_id, input.projectId),
            inArray(extension_instances.installed_extension_id, sources),
          ),
        )
        .returning()
    : [instance];
  return { instance: changed.find((row) => row.id === instance.id)!, changed };
};
export const activateProjectSources = (db: DbClient, inputs: ActivationInput[]) =>
  db.transaction(async (tx) => {
    const results = [];
    for (const input of inputs) results.push(await activateSource(tx, input));
    return results;
  });
