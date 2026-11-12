import type { SyncFileTransfer } from "pstdio-sync/relay";

/** Transient diagnostics owned by one source, never a second durable sync checkpoint. */
export const createSourceActivity = (changed?: () => void) => {
  let phase = "discovering";
  let phaseStartedAt = new Date().toISOString();
  let lastProgressAt: string | undefined;
  let startedAt: string | undefined;
  let completedAt: string | undefined;
  const spans = new Map<symbol, string>();
  let failedPhase: string | undefined;
  const files = new Map<string, SyncFileTransfer>();
  let announced = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const announce = () => {
    const remaining = 200 - (Date.now() - announced);
    if (remaining > 0) {
      timer ??= setTimeout(() => {
        timer = undefined;
        announced = Date.now();
        changed?.();
      }, remaining);
    } else {
      announced = Date.now();
      changed?.();
    }
  };
  const pending = (next: string) => {
    if (phase !== next) {
      phase = next;
      phaseStartedAt = new Date().toISOString();
    }
    announce();
  };
  const progress = () => {
    lastProgressAt = new Date().toISOString();
    announce();
  };
  return {
    resetPending() {
      for (const [id, transfer] of files)
        if (transfer.status === "active" || transfer.status === "queued") files.delete(id);
    },
    start() {
      startedAt = new Date().toISOString();
      completedAt = undefined;
      failedPhase = undefined;
      pending("discovering");
    },
    complete() {
      completedAt = new Date().toISOString();
      if (!spans.size) pending("ready");
    },
    pending,
    progress,
    network(event: { phase: string; bytes?: number }) {
      pending(event.phase);
      if (event.bytes) progress();
    },
    async run<T>(next: string, work: () => Promise<T>, signal?: AbortSignal) {
      const span = Symbol();
      spans.set(span, next);
      pending(next);
      try {
        signal?.throwIfAborted();
        const result = await work();
        signal?.throwIfAborted();
        progress();
        return result;
      } catch (error) {
        failedPhase = phase;
        throw error;
      } finally {
        spans.delete(span);
        pending([...spans.values()].at(-1) ?? failedPhase ?? "ready");
      }
    },
    file(transfer: SyncFileTransfer) {
      files.delete(transfer.id);
      files.set(transfer.id, transfer);
      // Keep recent terminal entries bounded without discarding active/queued work.
      const terminal = [...files].filter(([, file]) => ["completed", "failed"].includes(file.status));
      for (const [id] of terminal.slice(0, Math.max(0, terminal.length - 50))) files.delete(id);
      progress();
    },
    status: () => ({ phase, phaseStartedAt, lastProgressAt, startedAt, completedAt, files: [...files.values()] }),
    close: () => clearTimeout(timer),
  };
};
