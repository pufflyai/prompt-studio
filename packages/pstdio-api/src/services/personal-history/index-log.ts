import type { PersonalIndexDelta } from "pstdio-db";
import type { DocumentStore, StorageOwner } from "pstdio-sync";
import type { Json } from "pstdio-sync-contracts";
import { legacyPersonalHistoryOwner, type PersonalHistoryInput } from "./store";

const kinds = ["sessions", "workspaces", "workspace_sessions", "queues"] as const;
const parseDelta = (value: Json, writerId: string, accountId: string) => {
  const delta = value as unknown as PersonalIndexDelta;
  if (
    !delta ||
    typeof delta !== "object" ||
    typeof delta.deviceId !== "string" ||
    typeof delta.id !== "string" ||
    ![...kinds, "heads", "publications"].includes(delta.kind as (typeof kinds)[number]) ||
    (delta.value !== null && (typeof delta.value !== "object" || Array.isArray(delta.value))) ||
    (delta.seedId !== undefined && (typeof delta.seedId !== "string" || !delta.seedId))
  )
    throw new Error("Invalid private history index entry");
  if (delta.seedId ? delta.seedId !== writerId : delta.deviceId !== writerId)
    throw new Error("Private index writer does not own its delta");
  if (delta.value !== null) {
    const row = delta.value as Record<string, unknown>;
    if (row.id !== delta.id) throw new Error("Private index entry identity changed");
    if (kinds.includes(delta.kind as (typeof kinds)[number])) {
      const device = row.device as { id?: string; ownerId?: string } | undefined;
      if (device?.id !== delta.deviceId || device.ownerId !== accountId)
        throw new Error("Private index device ownership changed");
    }
  }
  return delta;
};

/** A bounded delta page and its materialized SQL cursor commit together. Legacy input is kept intact. */
export const createPersonalIndexLog = (input: PersonalHistoryInput, owner: StorageOwner, records: DocumentStore) => {
  const log = input.logs.open(owner, { name: "index", writer: "device" }, "project");
  const write = async (delta: PersonalIndexDelta) => {
    await log.append(delta as unknown as Json);
    await input.index.apply(owner, null, [delta]);
  };
  let preparing: Promise<void> | undefined;
  const migrate = async () => {
    if (await input.index.migrated(owner)) return;
    const deviceId = await input.logs.writerId();
    const legacy = await records.transaction(legacyPersonalHistoryOwner(input), async ({ document }) => ({
      records: kinds.flatMap((kind) =>
        [...document.getMap<string>(kind).entries()].map(([id, value]) => ({
          kind,
          id,
          value: JSON.parse(value) as Json,
        })),
      ),
      heads: [...document.getMap<number>("heads").entries()],
      publications: [...document.getMap<string>("publications").entries()],
    }));
    const devices = new Map(
      legacy.records
        .filter((row) => row.kind === "sessions")
        .map((row) => [row.id, (row.value as unknown as { device: { id: string } }).device.id]),
    );
    const deltas: PersonalIndexDelta[] = legacy.records.map((row) => ({
      ...row,
      deviceId: (row.value as unknown as { device: { id: string } }).device.id,
    }));
    deltas.push(
      ...legacy.heads.map(([id, sequence]) => ({
        deviceId: devices.get(id) ?? deviceId,
        kind: "heads",
        id,
        value: { id, sequence },
      })),
    );
    deltas.push(
      ...legacy.publications.map(([id, value]) => ({
        deviceId: devices.get(id) ?? deviceId,
        kind: "publications",
        id,
        value: { id, ...JSON.parse(value) },
      })),
    );
    for (const delta of deltas) await write({ ...delta, seedId: deviceId });
    await input.index.markMigrated(owner);
  };
  const ready = () =>
    (preparing ??= migrate().catch((error) => {
      preparing = undefined;
      throw error;
    }));
  return {
    ready,
    write,
    async synchronize() {
      await ready();
      const deviceId = await input.logs.writerId();
      let after: string | 0 = (await input.index.cursor(owner)) ?? 0;
      while (true) {
        const page = await log.read({ after, limit: 100 });
        await input.index.apply(
          owner,
          page.cursor,
          page.entries
            .filter((entry) => entry.writerId !== deviceId)
            .map((entry) => parseDelta(entry.value, entry.writerId, input.accountId)),
        );
        after = page.cursor;
        if (!page.more) return;
      }
    },
  };
};
