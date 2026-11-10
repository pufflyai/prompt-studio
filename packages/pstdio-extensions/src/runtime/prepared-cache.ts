import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withFileMutationLock } from "pstdio-paths";
import { type PreparedExtensionRevision, preparedCacheRoot } from "./prepared-revision";

const leaseId = `${process.pid}-${crypto.randomUUID()}.json`;
const leases = new Map<string, { revisions: Set<string>; webviews: Set<string> }>();
const locked = <T>(work: () => T) => {
  mkdirSync(preparedCacheRoot(), { recursive: true });
  return withFileMutationLock(join(preparedCacheRoot(), "maintenance"), work);
};
export const retainPreparedArtifacts = (revisionId?: string, webviewIds: string[] = []) =>
  locked(() => {
    const root = preparedCacheRoot();
    const current = leases.get(root) ?? { revisions: new Set<string>(), webviews: new Set<string>() };
    if (revisionId) current.revisions.add(revisionId);
    for (const id of webviewIds) current.webviews.add(id);
    leases.set(root, current);
    const directory = join(root, "leases");
    mkdirSync(directory, { recursive: true });
    const target = join(directory, leaseId);
    const temporary = `${target}.tmp`;
    writeFileSync(
      temporary,
      JSON.stringify({ pid: process.pid, revisions: [...current.revisions], webviews: [...current.webviews] }),
    );
    renameSync(temporary, target);
  });
export const retainPreparedRevision = (revision: PreparedExtensionRevision) =>
  retainPreparedArtifacts(
    revision.id,
    Object.values(revision.webviews ?? {}).map((view) => view.id),
  );

const records = (directory: string) => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(directory, name));
};
const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
};
const collectRoots = () => {
  const revisions = new Set<string>();
  const webviews = new Set<string>();
  for (const path of records(join(preparedCacheRoot(), "accepted"))) {
    try {
      const descriptor: PreparedExtensionRevision = JSON.parse(readFileSync(path, "utf8"));
      revisions.add(descriptor.id);
      for (const view of Object.values(descriptor.webviews ?? {})) webviews.add(view.id);
    } catch {}
  }
  for (const path of records(join(preparedCacheRoot(), "leases"))) {
    try {
      const lease: { pid: number; revisions: string[]; webviews: string[] } = JSON.parse(readFileSync(path, "utf8"));
      if (!isProcessAlive(lease.pid)) {
        rmSync(path, { force: true });
        continue;
      }
      for (const id of lease.revisions) revisions.add(id);
      for (const id of lease.webviews) webviews.add(id);
    } catch {}
  }
  return { revisions, webviews };
};
// A process lease outlives catalog replacement: callbacks and running harnesses can still
// read their original files. PID reuse conservatively retains files rather than deleting live data.
export const maintainPreparedCache = (now = Date.now()) => {
  const garbage = locked(() => {
    const garbageRoot = join(preparedCacheRoot(), "garbage");
    const garbage = existsSync(garbageRoot) ? readdirSync(garbageRoot).map((name) => join(garbageRoot, name)) : [];
    const roots = collectRoots();
    const cache = preparedCacheRoot();
    for (const [directory, retained] of [
      [join(cache, "revisions"), roots.revisions],
      [join(cache, "..", "prepared-webviews"), roots.webviews],
    ] as const) {
      if (!existsSync(directory)) continue;
      for (const name of readdirSync(directory)) {
        const path = join(directory, name);
        if (!retained.has(name) && now - statSync(path).mtimeMs > 60 * 60 * 1000) {
          const quarantine = join(cache, "garbage", crypto.randomUUID());
          mkdirSync(join(cache, "garbage"), { recursive: true });
          renameSync(path, quarantine);
          garbage.push(quarantine);
        }
      }
    }
    return garbage;
  });
  for (const path of garbage) rmSync(path, { recursive: true, force: true });
};
