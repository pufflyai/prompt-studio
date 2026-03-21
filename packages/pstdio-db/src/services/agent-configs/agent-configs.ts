import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { agent_configs } from "../../db/schemas.pg";

const nowTimestamp = () => new Date().toISOString();

export const createAgentConfigsService = (db: DbClient) => {
  const list = async () => db.select().from(agent_configs).orderBy(agent_configs.created_at);

  const get = async (agentId: string) => {
    const [row] = await db.select().from(agent_configs).where(eq(agent_configs.agent_id, agentId));
    return row ?? null;
  };

  const upsert = async (agentId: string, config?: string) => {
    const existing = await get(agentId);
    if (existing) {
      if (config !== undefined) {
        const timestamp = nowTimestamp();
        await db.update(agent_configs).set({ config, updated_at: timestamp }).where(eq(agent_configs.id, existing.id));
        return { ...existing, config, updated_at: timestamp };
      }
      return existing;
    }

    const all = await list();
    const isFirst = all.length === 0;
    const timestamp = nowTimestamp();

    const row = {
      id: crypto.randomUUID(),
      agent_id: agentId,
      is_default: isFirst,
      config: config ?? "{}",
      created_at: timestamp,
      updated_at: timestamp,
    };

    await db.insert(agent_configs).values(row);
    return row;
  };

  const update = async (agentId: string, fields: { is_default?: boolean; binary?: string; skills_dir?: string }) => {
    const existing = await get(agentId);
    if (!existing) return null;

    const timestamp = nowTimestamp();
    const updates: Record<string, unknown> = { updated_at: timestamp };
    let clearedDefaults: (typeof existing)[] = [];

    if (fields.is_default === true) {
      const allConfigs = await list();
      clearedDefaults = allConfigs
        .filter((c) => c.is_default && c.agent_id !== agentId)
        .map((c) => ({ ...c, is_default: false, updated_at: timestamp }));
      await db.update(agent_configs).set({ is_default: false, updated_at: timestamp });
      updates.is_default = true;
    }

    if (fields.binary !== undefined || fields.skills_dir !== undefined) {
      const current = JSON.parse(existing.config);
      if (fields.binary !== undefined) current.binary = fields.binary;
      if (fields.skills_dir !== undefined) current.skills_dir = fields.skills_dir;
      updates.config = JSON.stringify(current);
    }

    await db.update(agent_configs).set(updates).where(eq(agent_configs.id, existing.id));

    const updated = {
      ...existing,
      ...updates,
      config: (updates.config as string) ?? existing.config,
    };

    return { updated, clearedDefaults };
  };

  const remove = async (agentId: string) => {
    const existing = await get(agentId);
    if (!existing) return false;

    await db.delete(agent_configs).where(eq(agent_configs.id, existing.id));

    if (existing.is_default) {
      const remaining = await list();
      if (remaining.length > 0) {
        const timestamp = nowTimestamp();
        await db
          .update(agent_configs)
          .set({ is_default: true, updated_at: timestamp })
          .where(eq(agent_configs.id, remaining[0].id));
      }
    }

    return true;
  };

  return { list, get, upsert, update, remove };
};
