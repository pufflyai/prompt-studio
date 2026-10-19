import {
  backupCoverageSchema,
  backupHandleSchema,
  canonicalJson,
  type RelayBackupHandle,
  type RelayBackupScope,
  relayBackupCompletionSchema,
  relayBackupHour,
  relayBackupScopeSchema,
  relayBackupStatusSchema,
} from "pstdio-sync-contracts";
import type { ObjectConfig } from "../assets/objects";
import { copyKey, createBackupObjects } from "./objects";
import { verifyCapture, verifyPublication } from "./verification";

export const createRelayBackupCatalog = (config: ObjectConfig) => {
  const objects = createBackupObjects(config);
  const state = async (now = Date.now(), signal?: AbortSignal) => {
    const stored = await objects.status(signal);
    const status = stored ? relayBackupStatusSchema.parse(stored.value) : null;
    if (!status?.attempt) return { state: "never-completed", status, backup: null };
    const backup = status.latest;
    if (now < status.attempt.startedAt || now - status.attempt.startedAt >= relayBackupHour)
      return { state: "stale", status, backup };
    if (status.attempt.error) return { state: "failed", status, backup };
    if (status.attempt.finishedAt === null) return { state: "running", status, backup };
    if (!backup || now < backup.capturedAt || now - backup.capturedAt >= relayBackupHour)
      return { state: "stale", status, backup };
    return { state: "complete", status, backup };
  };
  const open = async (input: RelayBackupHandle, signal?: AbortSignal) => {
    const handle = backupHandleSchema.parse(input);
    if (!handle.key.startsWith("complete/") || !handle.key.endsWith(`/${handle.asset.sha256}`))
      throw new Error("Backup completion identity is invalid");
    const complete = await objects.json(handle.key, handle.asset, relayBackupCompletionSchema.parse, signal);
    if (complete.capturedAt !== handle.capturedAt) throw new Error("Backup recovery point mismatch");
    const manifests: RelayBackupScope[] = [];
    const scopes = new Set<string>();
    const verified = new Set<string>();
    for (const entry of complete.manifests) {
      const scopeId = canonicalJson(entry.scope);
      if (scopes.has(scopeId)) throw new Error("Duplicate backup scope");
      scopes.add(scopeId);
      const manifest = await objects.json(
        `manifests/${entry.asset.sha256}`,
        entry.asset,
        relayBackupScopeSchema.parse,
        signal,
      );
      await verifyCapture(manifest, entry.scope, objects, verified, signal);
      manifests.push(manifest);
    }
    for (const manifest of manifests) verifyPublication(manifest, manifests);
    return {
      backup: handle,
      manifests,
      read: async (asset: Parameters<typeof copyKey>[0]) => objects.read(await copyKey(asset), asset, signal),
    };
  };
  return {
    status: state,
    open,
    async list() {
      const handles: RelayBackupHandle[] = [];
      for await (const entry of objects.completions()) {
        const complete = await objects.json(entry.key, entry.asset, relayBackupCompletionSchema.parse);
        handles.push({ ...entry, capturedAt: complete.capturedAt });
      }
      return handles;
    },
    async readCoverage(now = Date.now(), signal?: AbortSignal) {
      const coverage: ReturnType<typeof backupCoverageSchema.parse>[] = [];
      let backup: RelayBackupHandle | null = null;
      try {
        const current = await state(now, signal);
        backup = current.backup;
        if (current.state !== "complete" || !backup)
          return { state: current.state, backup, coverage, error: current.status?.attempt?.error ?? null };
        const verified = await open(backup, signal);
        for (const manifest of verified.manifests) {
          const snapshot = manifest.capture.snapshot;
          coverage.push(
            backupCoverageSchema.parse({
              scope: snapshot.scope,
              epoch: snapshot.checkpoint.epoch,
              generation: snapshot.generation,
              cut: snapshot.checkpoint.sequence,
              snapshotHash: manifest.capture.snapshotHash,
              manifestHash: backup.asset.sha256,
            }),
          );
        }
        return { state: "verified", backup, coverage, error: null };
      } catch (error) {
        return { state: "failed", backup, coverage: [], error: error instanceof Error ? error.message : String(error) };
      }
    },
    close: objects.close,
  };
};
