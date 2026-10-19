import {
  type RelayBackupScope,
  type RelayBackupStatus,
  relayBackupHour,
  relayBackupScopeSchema,
  relayBackupStatusSchema,
} from "pstdio-sync-contracts";
import { type AssetConfig, createRelayAssets } from "../assets/assets";
import type { ObjectConfig } from "../assets/objects";
import { createRelayBackupCatalog } from "./catalog";
import { createBackupObjects } from "./objects";
import { createBackupSource } from "./source";

export { createRelayBackupCatalog } from "./catalog";
export interface RelayBackupConfig {
  databaseUrl: string;
  live: ObjectConfig;
  backup: ObjectConfig;
}
const endpointIdentity = (endpoint: ObjectConfig["s3"]["endpoint"]) => {
  if (typeof endpoint === "string" || endpoint instanceof URL) return new URL(endpoint).href.replace(/\/$/, "");
  return endpoint;
};
export const createRelayBackupWorker = (config: RelayBackupConfig) => {
  if (
    config.live.bucket === config.backup.bucket &&
    endpointIdentity(config.live.s3.endpoint) === endpointIdentity(config.backup.s3.endpoint)
  )
    throw new Error("Relay backups require a separate private bucket");
  const source = createBackupSource(config.databaseUrl);
  const live = createRelayAssets({ ...config.live, databaseUrl: config.databaseUrl } satisfies AssetConfig);
  const objects = createBackupObjects(config.backup);
  const catalog = createRelayBackupCatalog(config.backup);
  const shutdown = new AbortController();
  let active: Promise<number> | undefined;
  const copyCaptured = async (captured: Omit<RelayBackupScope, "protocolVersion">[], ownedSignal: AbortSignal) => {
    const manifests = [];
    for (const entry of captured) {
      for (const reference of entry.capture.references)
        await objects.copy(
          reference.asset,
          async () => {
            const read = await live.read(reference.scope, reference.asset, 0, ownedSignal);
            if (!read) throw new Error("Backup source bytes are unavailable");
            return read.body;
          },
          ownedSignal,
        );
      const manifest = relayBackupScopeSchema.parse({ protocolVersion: 2, ...entry });
      const saved = await objects.putJson("manifests/", manifest, ownedSignal);
      manifests.push({ scope: entry.capture.snapshot.scope, asset: saved.asset });
    }
    return manifests;
  };
  const saveFailure = async (status: RelayBackupStatus, etag: string, error: unknown, signal: AbortSignal) => {
    if (signal.aborted) return;
    const message = error instanceof Error ? error.message : String(error);
    const failed = { ...status, attempt: { ...status.attempt!, finishedAt: Date.now(), error: message } };
    await objects.writeStatus(failed, etag, signal).catch(() => {});
  };
  const run = (now: number, requestSignal?: AbortSignal) => {
    const signal = requestSignal ? AbortSignal.any([shutdown.signal, requestSignal]) : shutdown.signal;
    return source
      .run(async (database, ownedSignal) => {
        const stored = await objects.status(ownedSignal);
        const previous = stored ? relayBackupStatusSchema.parse(stored.value) : null;
        const dueAt = previous?.attempt ? previous.attempt.startedAt + relayBackupHour : now;
        if (previous?.attempt?.finishedAt !== null && now < dueAt) return dueAt;
        let status: RelayBackupStatus = {
          protocolVersion: 2,
          attempt: { id: crypto.randomUUID(), startedAt: now, finishedAt: null, error: null },
          latest: previous?.latest ?? null,
        };
        let etag = await objects.writeStatus(status, stored?.etag, ownedSignal);
        let ids: string[] = [];
        try {
          await objects.discardIncomplete(ownedSignal);
          const captured = await database.capture(status.attempt!.id);
          ids = captured.map((entry) => entry.capture.id);
          const manifests = await copyCaptured(captured, ownedSignal);
          const complete = await objects.putJson(
            `complete/${status.attempt!.id}/`,
            {
              protocolVersion: 2,
              capturedAt: now,
              manifests,
            },
            ownedSignal,
          );
          const handle = { ...complete, capturedAt: now };
          // Reopen the entire capture through backup-only reads before publishing coverage.
          await catalog.open(handle, ownedSignal);
          ownedSignal.throwIfAborted();
          status = { ...status, attempt: { ...status.attempt!, finishedAt: Date.now() }, latest: handle };
          etag = await objects.writeStatus(status, etag, ownedSignal);
          return now + relayBackupHour;
        } catch (error) {
          await saveFailure(status, etag, error, ownedSignal);
          throw error;
        } finally {
          await database.release(ids);
        }
      }, signal)
      .then((due) => due ?? now + 60_000);
  };
  return {
    tick(now = Date.now(), signal?: AbortSignal) {
      active ??= run(now, signal).finally(() => {
        active = undefined;
      });
      return active;
    },
    async close() {
      shutdown.abort(new Error("Backup worker stopped"));
      await active?.catch(() => {});
      const results = await Promise.allSettled([source.close(), live.close()]);
      objects.close();
      catalog.close();
      if (results.some((result) => result.status === "rejected")) throw new Error("Backup storage shutdown failed");
    },
  };
};
