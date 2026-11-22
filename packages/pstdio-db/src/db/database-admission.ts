import { AsyncResource } from "node:async_hooks";
import type { PGlite } from "@electric-sql/pglite";
import { currentRuntimeOperationOrigin, finishRuntimeOperation, startRuntimeOperation } from "pstdio-diagnostics";

// PGlite settles its queued statements back to back in microtasks. Without a macrotask turn, a burst
// of extension writes keeps health probes, cancellation and every other request waiting until it ends.
const DEFAULT_SLICE_MS = 10;
// Core persistence and interactive reads go first, but sustained core work still leaves extensions a turn.
// Turns use timers, not setImmediate: under load in Bun 1.4.4, adding these immediates made the read
// boundary's own setImmediate callback never run (3 of 24 parallel API test runs hung; 0 of 48 with timers).
const CORE_TURNS_PER_EXTENSION_TURN = 4;

type Turn = () => void;

/**
 * Orders top-level database work: core first, extensions in turn, and an event-loop turn after
 * each slice of continuous work. Order within one owner stays first-in, first-out.
 */
export const createDatabaseAdmission = ({ sliceMs = DEFAULT_SLICE_MS } = {}) => {
  const core: Turn[] = [];
  // Map order is the round-robin order. An extension leaves the map when its queue empties.
  const extensions = new Map<string, Turn[]>();
  let active = false;
  let queued = 0;
  let lastReleasedAt = Number.NEGATIVE_INFINITY;
  let closing = false;
  const drained = Promise.withResolvers<void>();
  let coreStreak = 0;
  let sliceStartedAt = performance.now();
  let turnObserved = false;

  const observeNextTurn = () => {
    if (turnObserved) return;
    turnObserved = true;
    setTimeout(() => {
      turnObserved = false;
      sliceStartedAt = performance.now();
    }, 0);
  };

  const nextExtensionTurn = () => {
    const [extensionId, queue] = extensions.entries().next().value!;
    extensions.delete(extensionId);
    const turn = queue.shift()!;
    if (queue.length > 0) extensions.set(extensionId, queue);
    coreStreak = 0;
    return turn;
  };

  const nextTurn = () => {
    if (core.length > 0 && (extensions.size === 0 || coreStreak < CORE_TURNS_PER_EXTENSION_TURN)) {
      coreStreak += 1;
      return core.shift()!;
    }
    return nextExtensionTurn();
  };

  const dispatch = () => {
    if (active || (core.length === 0 && extensions.size === 0)) return;
    active = true;
    if (performance.now() - sliceStartedAt >= sliceMs) {
      setTimeout(() => {
        sliceStartedAt = performance.now();
        active = false;
        dispatch();
      }, 0);
      return;
    }
    observeNextTurn();
    nextTurn()();
  };

  const release = () => {
    active = false;
    lastReleasedAt = performance.now();
    dispatch();
    if (closing && !active && queued === 0) drained.resolve();
  };

  const run = <T>(extensionId: string | undefined, work: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      if (closing) {
        reject(new Error("PGlite is closed"));
        return;
      }
      // A database left idle for a slice has already given the event loop its turn.
      if (!active && queued === 0 && performance.now() - lastReleasedAt >= sliceMs) sliceStartedAt = performance.now();
      const waiting = startRuntimeOperation("database.admission", { queued });
      queued += 1;
      // The turn starts from whichever caller released last. Bind it so the work, its diagnostics
      // and any timers it creates keep the origin of the caller that queued it.
      const turn = AsyncResource.bind(() => {
        queued -= 1;
        finishRuntimeOperation(waiting);
        let result: Promise<T>;
        try {
          result = work();
        } catch (error) {
          result = Promise.reject(error);
        }
        result.then(resolve, reject).finally(release);
      });
      if (extensionId === undefined) core.push(turn);
      else {
        const queue = extensions.get(extensionId);
        if (queue) queue.push(turn);
        else extensions.set(extensionId, [turn]);
      }
      dispatch();
    });

  /** Admitted work finishes before the engine closes; work arriving afterwards is refused. */
  const close = () => {
    closing = true;
    if (!active && queued === 0) drained.resolve();
    return drained.promise;
  };

  return { run, close };
};

/**
 * PGlite routes query, exec and transaction through one exclusive section, and transaction
 * handles run inside it. Admitting that section schedules every top-level statement exactly once.
 * Pauses between slices let shutdown start mid-burst, so close waits for the admitted work first.
 */
export const admitPgliteWork = <Database extends Pick<PGlite, "_runExclusiveTransaction" | "close">>(
  database: Database,
  admission = createDatabaseAdmission(),
) => {
  const exclusive = database._runExclusiveTransaction;
  database._runExclusiveTransaction = function <T>(this: Database, work: () => Promise<T>) {
    return admission.run(currentRuntimeOperationOrigin()?.extensionId, () => exclusive.call(this, work) as Promise<T>);
  };
  const close = database.close;
  database.close = async function (this: Database) {
    await admission.close();
    return close.call(this);
  };
  return database;
};
