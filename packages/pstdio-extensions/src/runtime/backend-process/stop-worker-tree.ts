import { stopWindowsProcessTree } from "../preparation-windows-process-tree";
import { type ProcessEntry, readProcesses, timeLeft, unfinished } from "./worker-tree-rows";

export type WorkerProcess = Pick<Bun.Subprocess, "pid" | "exitCode" | "signalCode" | "exited" | "kill">;
type RequestGroupAnchor = () => Promise<number | null>;

const signal = (pid: number, value: NodeJS.Signals) => {
  try {
    process.kill(pid, value);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    return false;
  }
};

export const isWorkerAlive = (child: WorkerProcess) => child.exitCode === null && child.signalCode === null;
// Linux may keep a zombie thread-group leader while its siblings are still executing.
export const running = (row: ProcessEntry) =>
  (row.threads ?? 1) > 1 || (!/^[ZX]/.test(row.state) && !row.state.includes("E"));
export interface Ownership {
  workerStart?: string;
  groupAnchor?: ProcessEntry;
  children: Map<number, ProcessEntry>;
}

const groupAnchorPresent = (rows: ProcessEntry[], anchor: ProcessEntry) =>
  rows.some(
    (row) => row.pid === anchor.pid && row.started === anchor.started && row.group === anchor.group && running(row),
  );

export const observeWorker = (rows: ProcessEntry[], child: WorkerProcess, owned: Ownership) => {
  if (!isWorkerAlive(child)) return;
  const root = rows.find(
    (row) =>
      row.pid === child.pid &&
      row.parent === process.pid &&
      (owned.workerStart === undefined || row.started === owned.workerStart),
  );
  if (root) owned.workerStart = root.started;
  return root;
};

const refreshOwnership = (rows: ProcessEntry[], child: WorkerProcess, owned: Ownership) => {
  const root = observeWorker(rows, child, owned);
  // After the worker exits, only a member verified before TERM can authorize the old group.
  const workerGroup =
    (root?.group === child.pid && running(root)) || (owned.groupAnchor && groupAnchorPresent(rows, owned.groupAnchor))
      ? child.pid
      : undefined;
  const byParent = new Map<number, ProcessEntry[]>();
  for (const row of rows) {
    const children = byParent.get(row.parent) ?? [];
    children.push(row);
    byParent.set(row.parent, children);
  }
  const pending = rows.filter((row) => {
    if (row.pid === child.pid) return false;
    const previous = owned.children.get(row.pid);
    return previous ? previous.started === row.started : row.group === workerGroup;
  });
  for (const row of pending) owned.children.set(row.pid, row);
  if (root) pending.push(root);
  const visited = new Set(pending.map((row) => row.pid));
  for (const current of pending) {
    for (const row of byParent.get(current.pid) ?? []) {
      if (visited.has(row.pid)) continue;
      visited.add(row.pid);
      const previous = owned.children.get(row.pid);
      if (previous && previous.started !== row.started) continue;
      owned.children.set(row.pid, row);
      pending.push(row);
    }
  }
  return { root, workerGroup };
};

const pauseWorker = async (child: WorkerProcess, deadline: number, owned: Ownership) => {
  refreshOwnership(await readProcesses(deadline), child, owned);
  if (!isWorkerAlive(child)) return;
  child.kill("SIGSTOP");
  while (isWorkerAlive(child)) {
    const rows = await readProcesses(deadline);
    const { root } = refreshOwnership(rows, child, owned);
    // Delivery and actual suspension are separate. A spawn can complete in between.
    if (root && /^[Tt]/.test(root.state)) return rows;
    await Bun.sleep(Math.min(10, Math.max(0, timeLeft(deadline))));
  }
};

const untilDeadline = async <Value>(operation: Promise<Value>, deadline: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), Math.max(0, timeLeft(deadline)));
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const stopGracefully = async (
  child: WorkerProcess,
  owned: Ownership,
  deadline: number,
  requestGroupAnchor: RequestGroupAnchor,
) => {
  const initial = refreshOwnership(await readProcesses(deadline), child, owned);
  if (!initial.workerGroup) return;
  const pid = await untilDeadline(Promise.race([requestGroupAnchor(), child.exited.then(() => null)]), deadline);
  if (!pid) return;
  const rows = await readProcesses(deadline);
  const { root } = refreshOwnership(rows, child, owned);
  if (!root || root.group !== child.pid) return;
  const anchor = rows.find(
    (row) => row.pid === pid && row.parent === root.pid && row.group === root.group && running(row),
  );
  if (!anchor) return;
  owned.groupAnchor = anchor;
  const paused = await pauseWorker(child, deadline, owned);
  if (!paused || !groupAnchorPresent(paused, anchor) || !isWorkerAlive(child) || timeLeft(deadline) <= 0) return;
  child.kill("SIGTERM");
  child.kill("SIGCONT");
  await untilDeadline(child.exited, deadline);
};

const darwinExiting = (error: unknown) =>
  process.platform === "darwin" && (error as NodeJS.ErrnoException).code === "EPERM";

const tryTerminate = (pid: number, failures: unknown[]) => {
  try {
    return signal(pid, "SIGKILL");
  } catch (error) {
    // ADR 0115: a Darwin process can refuse a signal while it is exiting.
    if (!darwinExiting(error)) failures.push(error);
    return false;
  }
};

const stopOwned = async (child: WorkerProcess, owned: Ownership, deadline: number) => {
  const rows = await readProcesses(deadline);
  const { workerGroup } = refreshOwnership(rows, child, owned);
  const selected = rows.filter((row) => running(row) && owned.children.get(row.pid)?.started === row.started);
  const members = new Set(selected.map((row) => row.pid));
  const groups = new Set<number>();
  const failures: unknown[] = [];
  if (workerGroup !== undefined && tryTerminate(-workerGroup, failures)) groups.add(workerGroup);
  for (const { group, pid } of selected) {
    if (group !== pid || !rows.every((row) => row.group !== group || !running(row) || members.has(row.pid))) continue;
    if (tryTerminate(-group, failures)) groups.add(group);
  }
  const fallback = new Map(selected.filter((row) => !groups.has(row.group)).map((row) => [row.pid, row.started]));
  // Fallback signals use a fresh start identity, especially after the group leader disappears.
  const current = fallback.size ? await readProcesses(deadline) : [];
  for (const row of current) {
    if (!running(row) || fallback.get(row.pid) !== row.started) continue;
    tryTerminate(row.pid, failures);
  }
  if (failures.length) throw new AggregateError(failures, "Could not signal the extension backend worker's children.");
  return groups;
};

const finishWorker = (child: WorkerProcess) => {
  if (!isWorkerAlive(child)) return;
  try {
    child.kill("SIGKILL");
  } catch (error) {
    if (isWorkerAlive(child)) child.kill("SIGCONT");
    throw error;
  }
};

const stopPosixWorker = async (
  child: WorkerProcess,
  timeoutMs: number,
  requestGroupAnchor: RequestGroupAnchor | undefined,
  observation: Promise<Ownership> | undefined,
) => {
  let deadline = performance.now() + timeoutMs;
  let groups: Set<number> | undefined;
  let owned: Ownership;
  try {
    // Joining the current sample consumes the first phase's existing allowance.
    const observed = observation ? await untilDeadline(observation, deadline) : { children: new Map() };
    if (!observed) throw unfinished();
    owned = observed;
    if (!isWorkerAlive(child) && !owned.children.size) return;
    if (requestGroupAnchor) {
      // Failed or expired anchor preparation falls through to forced cleanup.
      await stopGracefully(child, owned, deadline, requestGroupAnchor).catch(() => {});
      deadline = performance.now() + timeoutMs;
    }
    await pauseWorker(child, deadline, owned);
    groups = await stopOwned(child, owned, deadline);
  } finally {
    if (!groups?.has(child.pid)) finishWorker(child);
  }
  while (true) {
    const rows = await readProcesses(deadline);
    const knownChildren = rows.filter((row) => owned.children.get(row.pid)?.started === row.started);
    const knownGroups = new Set(
      knownChildren
        .filter((row) => groups.has(row.group) && owned.children.get(row.pid)?.group === row.group)
        .map((row) => row.group),
    );
    if (
      !isWorkerAlive(child) &&
      !knownChildren.some(running) &&
      !rows.some((row) => running(row) && knownGroups.has(row.group))
    )
      return;
    await Bun.sleep(Math.min(20, Math.max(0, timeLeft(deadline))));
  }
};

const stopWindowsWorker = async (child: WorkerProcess, timeoutMs: number) => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = unfinished();
      controller.abort(error);
      try {
        if (isWorkerAlive(child)) child.kill("SIGKILL");
      } catch (failure) {
        reject(new AggregateError([error, failure], error.message));
        return;
      }
      reject(error);
    }, timeoutMs);
  });
  try {
    // Keep the leader alive until taskkill has had its opportunity to discover children.
    await Promise.race([stopWindowsProcessTree(child, undefined, controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
};

export const stopBackendWorkerTree = async (
  child: WorkerProcess,
  timeoutMs: number,
  requestGroupAnchor?: RequestGroupAnchor,
  observation?: Promise<Ownership>,
) => {
  if (process.platform === "win32") {
    if (!isWorkerAlive(child)) return;
    return stopWindowsWorker(child, timeoutMs);
  }
  return stopPosixWorker(child, timeoutMs, requestGroupAnchor, observation);
};
