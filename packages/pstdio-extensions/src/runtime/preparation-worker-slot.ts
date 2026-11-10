import type { Worker } from "node:worker_threads";
import { registerFileMutationWorker } from "pstdio-paths";
import { ownPreparationCommands } from "./preparation-command";
import { preparationUnavailable } from "./preparation-error";
import type { Job } from "./preparation-queue";

export interface PreparationWorkerSlot {
  index: number;
  worker?: Worker;
  factory?: () => Worker;
  ready: boolean;
  active?: Job;
  dispatched: boolean;
  restarting?: Promise<void>;
  retiring?: Job;
  waitingBuilds: number;
  activeBuilds: number;
}
interface Message {
  kind?: string;
  event: { kind?: string; [key: string]: unknown };
  id?: number;
  error?: { message: string };
  value?: unknown;
}
export const createPreparationWorkerSlots = (
  count: number,
  input: {
    factory(): () => Worker;
    pump(): void;
    event(slot: PreparationWorkerSlot, event: Message["event"]): void;
    failed(slot: PreparationWorkerSlot, error: unknown): void;
    completed(job: Job, error: unknown, value?: unknown): void;
  },
) => {
  const slots: PreparationWorkerSlot[] = Array.from({ length: count }, (_, index) => ({
    index,
    ready: false,
    dispatched: false,
    waitingBuilds: 0,
    activeBuilds: 0,
  }));
  const retirements = new WeakMap<Worker, () => Promise<void>>();
  const retire = async (worker: Worker) => {
    await retirements.get(worker)?.();
    await worker.terminate();
  };
  const replace = (slot: PreparationWorkerSlot, resume?: Job, notify = true) => {
    const worker = slot.worker;
    if (!worker) return;
    slot.retiring = slot.active;
    slot.worker = undefined;
    slot.ready = false;
    slot.active = resume;
    slot.dispatched = false;
    slot.restarting = Promise.resolve()
      .then(() => retire(worker))
      .finally(() => {
        slot.restarting = undefined;
        slot.retiring = undefined;
        input.pump();
      });
    if (notify) input.event(slot, { kind: "worker-lost" });
  };
  const start = (slot: PreparationWorkerSlot) => {
    if (slot.worker || slot.restarting) return;
    slot.factory = input.factory();
    let worker: Worker;
    try {
      worker = slot.factory();
    } catch (error) {
      input.failed(slot, preparationUnavailable(error));
      return;
    }
    slot.worker = worker;
    registerFileMutationWorker(worker);
    const stopCommands = ownPreparationCommands(worker, (state) => {
      if (state === "waiting") slot.waitingBuilds++;
      if (state === "admitted") slot.waitingBuilds--;
      if (state === "started") slot.activeBuilds++;
      if (state === "finished") slot.activeBuilds--;
      input.pump();
    });
    retirements.set(worker, stopCommands);
    const fail = (error: unknown) => {
      if (slot.worker !== worker) return;
      input.failed(slot, preparationUnavailable(error));
      replace(slot);
    };
    worker.on("message", (message: Message) => {
      if (slot.worker !== worker) return;
      if (message.kind === "event") return input.event(slot, message.event);
      if (message.kind === "ready") {
        slot.ready = true;
        input.event(slot, { kind: "worker-ready" });
        input.pump();
        return;
      }
      if (!slot.dispatched || !slot.active || message.id !== slot.active.id) return;
      const job = slot.active;
      slot.active = undefined;
      slot.dispatched = false;
      input.completed(
        job,
        message.error ? Object.assign(new Error(message.error.message), message.error) : undefined,
        message.value,
      );
      input.pump();
    });
    worker.on("error", fail);
    worker.on("exit", (code) => {
      void stopCommands();
      fail(new Error(`Extension preparation worker exited (${code}).`));
    });
  };
  return {
    slots,
    start,
    replace,
    async stop() {
      const pending = slots.map((slot) => {
        replace(slot, undefined, false);
        return slot.restarting;
      });
      await Promise.all(pending);
      for (const slot of slots) slot.active = undefined;
    },
  };
};
