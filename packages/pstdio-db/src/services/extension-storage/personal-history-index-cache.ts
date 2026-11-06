import { and, eq } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { canonicalJson } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_personal_history as rows } from "../../db/schemas.pg";

type Row = typeof rows.$inferSelect;
const key = (kind: string, id: string) => JSON.stringify([kind, id]);
/** SQL owns durability; cached row identities preserve the accepted incremental personal-reader behavior. */
export const createPersonalIndexCache = (db: DbClient) => {
  const owners = new Map<string, Promise<ReturnType<typeof create>>>();
  const create = (initial: Row[]) => {
    const devices = new Map<string, Map<string, Row>>();
    const kinds = new Map<string, Record<string, unknown>[]>();
    let visibleRevision = {};
    const apply = (changes: Row[]) => {
      for (const row of changes) {
        const device = devices.get(row.device_id) ?? new Map<string, Row>();
        devices.set(row.device_id, device);
        const previous = device.get(key(row.kind, row.record_id));
        const same = canonicalJson(previous?.value ?? null) === canonicalJson(row.value);
        if (same && previous) row.value = previous.value;
        device.set(key(row.kind, row.record_id), row);
        if (same) continue;
        kinds.delete(row.kind);
        if (row.kind !== "heads" && row.kind !== "publications") visibleRevision = {};
      }
    };
    apply(initial);
    return {
      apply,
      devices,
      get visibleRevision() {
        return visibleRevision;
      },
      read(kind: string) {
        let found = kinds.get(kind);
        if (!found) {
          found = [...devices.values()].flatMap((device) =>
            [...device.values()]
              .filter((row) => row.kind === kind && row.value !== null)
              .map((row) => row.value as Record<string, unknown>),
          );
          kinds.set(kind, found);
        }
        return found;
      },
      get(kind: string, id: string) {
        for (const device of devices.values()) {
          const row = device.get(key(kind, id));
          if (row?.value !== undefined && row.value !== null) return row.value as Record<string, unknown>;
        }
        return undefined;
      },
      seeded(kind: string, deviceId: string) {
        return new Set(
          [...(devices.get(deviceId)?.values() ?? [])]
            .filter((row) => row.kind === kind && row.seed_id)
            .map((row) => row.record_id),
        );
      },
      isSeeded(kind: string, deviceId: string, id: string) {
        return Boolean(devices.get(deviceId)?.get(key(kind, id))?.seed_id);
      },
      device(kind: string, deviceId: string) {
        return [...(devices.get(deviceId)?.values() ?? [])]
          .filter((row) => row.kind === kind && row.value !== null)
          .map((row) => row.value as Record<string, unknown>);
      },
    };
  };
  return (owner: StorageOwner) => {
    const id = JSON.stringify(owner);
    let current = owners.get(id);
    if (!current) {
      current = db
        .select()
        .from(rows)
        .where(and(eq(rows.workbench_id, owner.workbenchId), eq(rows.extension_id, owner.extensionId)))
        .then(create);
      owners.set(id, current);
      void current.catch(() => {
        if (owners.get(id) === current) owners.delete(id);
      });
    }
    return current;
  };
};
