import { isProcessAlive } from "pstdio-paths";
import { isWorkerAlive, type Ownership, observeWorker, running, type WorkerProcess } from "./stop-worker-tree";
import { type ProcessEntry, readDirectChildren, readProcesses } from "./worker-tree-rows";

// Retain lineage before reparenting. A child that detaches and reparents between samples can still be missed.
const OBSERVATION_INTERVAL_MS = 200;
const OBSERVATION_TIMEOUT_MS = 100;

const recordChildren = (rows: ProcessEntry[], parents: ProcessEntry[], owned: Ownership) => {
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  const verifiedParents = new Set(
    parents.filter((parent) => byPid.get(parent.pid)?.started === parent.started).map((parent) => parent.pid),
  );
  const discovered = rows.filter(
    (row) => verifiedParents.has(row.parent) && !owned.children.has(row.pid) && running(row),
  );
  for (const row of discovered) owned.children.set(row.pid, row);
  return discovered;
};

const observe = async (child: WorkerProcess, owned: Ownership) => {
  if (!isWorkerAlive(child)) return;
  const deadline = performance.now() + OBSERVATION_TIMEOUT_MS;
  const direct = readDirectChildren(child.pid, deadline);
  // Idle workers do not need to spawn ps or sample any other process.
  if (!direct.length && !owned.children.size) return;
  const rows = await readProcesses(deadline, [...new Set([child.pid, ...owned.children.keys(), ...direct])]);
  const root = observeWorker(rows, child, owned);
  if (!root) return;
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  const known: ProcessEntry[] = [];
  for (const [pid, previous] of owned.children) {
    const row = byPid.get(pid);
    if (row?.started === previous.started && running(row)) known.push(row);
    else if (row || !isProcessAlive(pid)) owned.children.delete(pid);
  }

  // A previously verified child remains owned even if it leaves the parent's group or reparents.
  let parents = [...known, ...recordChildren(rows, [root], owned)];
  while (parents.length) {
    const candidates = parents.flatMap((parent) => readDirectChildren(parent.pid, deadline));
    if (!candidates.length) return;
    const identities = await readProcesses(deadline, [...new Set([...parents.map((row) => row.pid), ...candidates])]);
    parents = recordChildren(identities, parents, owned);
  }
};

export const startWorkerTreeObservation = (child: WorkerProcess) => {
  if (process.platform !== "linux" && process.platform !== "darwin") return;
  const owned: Ownership = { children: new Map() };
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sampling: Promise<void> | undefined;
  const schedule = (delay: number) => {
    timer = setTimeout(() => {
      sampling = observe(child, owned)
        .catch(() => {
          // A process may exit mid-sample. Retirement still rechecks all retained identities.
        })
        .finally(() => {
          if (!closed && isWorkerAlive(child)) schedule(OBSERVATION_INTERVAL_MS);
        });
    }, delay);
    timer.unref();
  };

  schedule(0);
  return {
    async stop() {
      closed = true;
      clearTimeout(timer);
      await sampling;
      return owned;
    },
  };
};
