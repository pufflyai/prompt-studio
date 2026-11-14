import { and, eq, isNotNull, type SQL } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { canonicalJson } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_personal_history as rows } from "../../db/schemas.pg";

type Row = typeof rows.$inferSelect;
const key = (row: Pick<Row, "device_id" | "kind" | "record_id">) =>
  JSON.stringify([row.device_id, row.kind, row.record_id]);

/** SQL owns selection; retain identities only for records readers actually requested. */
export const createPersonalIndexCache = (db: DbClient) => {
  const owners = new Map<string, ReturnType<typeof create>>();
  const create = (owner: StorageOwner) => {
    const identities = new Map<string, Row>();
    const points = new Map<string, Row | undefined>();
    const kinds = new Map<string, Record<string, unknown>[]>();
    let visibleRevision = {};
    let generation = 0;
    const remember = (row: Row) => {
      const id = key(row);
      const previous = identities.get(id);
      if (previous && canonicalJson(previous.value) === canonicalJson(row.value)) row.value = previous.value;
      identities.delete(id);
      identities.set(id, row);
      if (identities.size > 500) identities.delete(identities.keys().next().value!);
      return row;
    };
    const select = (kind: string, condition?: SQL) =>
      db
        .select()
        .from(rows)
        .where(
          and(
            eq(rows.workbench_id, owner.workbenchId),
            eq(rows.extension_id, owner.extensionId),
            eq(rows.kind, kind),
            condition,
          ),
        );
    return {
      apply(changes: Row[]) {
        if (changes.length) generation++;
        for (const row of changes) {
          points.delete(JSON.stringify([row.kind, row.record_id]));
          const previous = identities.get(key(row));
          const same = previous && canonicalJson(previous.value) === canonicalJson(row.value);
          if (previous) remember(row);
          if (same) continue;
          kinds.delete(row.kind);
          if (row.kind !== "heads" && row.kind !== "publications") visibleRevision = {};
        }
      },
      get visibleRevision() {
        return visibleRevision;
      },
      async read(kind: string) {
        let found = kinds.get(kind);
        if (!found) {
          const started = generation;
          const selected = await select(kind, isNotNull(rows.value));
          if (started !== generation) return selected.map((row) => row.value as Record<string, unknown>);
          found = selected.map((row) => remember(row).value as Record<string, unknown>);
          kinds.set(kind, found);
        }
        return found;
      },
      async get(kind: string, id: string) {
        const point = JSON.stringify([kind, id]);
        if (points.has(point)) return points.get(point)?.value as Record<string, unknown> | undefined;
        const started = generation;
        const row = (await select(kind, and(eq(rows.record_id, id), isNotNull(rows.value))).limit(1))[0];
        if (started !== generation) return row?.value as Record<string, unknown> | undefined;
        const found = row ? remember(row) : undefined;
        points.set(point, found);
        if (points.size > 500) points.delete(points.keys().next().value!);
        return found?.value as Record<string, unknown> | undefined;
      },
      async seeded(kind: string, deviceId: string) {
        const selected = await db
          .select({ id: rows.record_id })
          .from(rows)
          .where(
            and(
              eq(rows.workbench_id, owner.workbenchId),
              eq(rows.extension_id, owner.extensionId),
              eq(rows.kind, kind),
              eq(rows.device_id, deviceId),
              isNotNull(rows.seed_id),
            ),
          );
        return new Set(selected.map(({ id }) => id));
      },
      async isSeeded(kind: string, deviceId: string, id: string) {
        return Boolean(
          (
            await select(
              kind,
              and(eq(rows.device_id, deviceId), eq(rows.record_id, id), isNotNull(rows.seed_id)),
            ).limit(1)
          )[0],
        );
      },
      async device(kind: string, deviceId: string) {
        return (await select(kind, and(eq(rows.device_id, deviceId), isNotNull(rows.value)))).map(
          (row) => remember(row).value as Record<string, unknown>,
        );
      },
    };
  };
  return (owner: StorageOwner) => {
    const id = JSON.stringify(owner);
    let current = owners.get(id);
    if (!current) {
      current = create(owner);
      owners.set(id, current);
    }
    return current;
  };
};
