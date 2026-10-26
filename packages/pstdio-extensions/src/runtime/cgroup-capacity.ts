import { readFile } from "node:fs/promises";
import { join, posix } from "node:path";

const finite = (value: string | undefined) => {
  if (value === undefined || !value.trim()) return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};
const decodePath = (value: string) =>
  value.replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(Number.parseInt(octal, 8)));
const minimum = (a: number | undefined, b: number | undefined) => {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
};

const parseMounts = (contents: string) =>
  contents.split("\n").flatMap((line) => {
    const [before, after] = line.split(" - ");
    const fields = before?.split(" ");
    const [type, , options] = after?.split(" ") ?? [];
    if (!fields?.[3] || !fields[4] || (type !== "cgroup" && type !== "cgroup2")) return [];
    return [
      { root: decodePath(fields[3]), point: decodePath(fields[4]), type, controllers: options?.split(",") ?? [] },
    ];
  });

const ancestors = (mount: { root: string; point: string }, member: string) => {
  const relative = posix.relative(mount.root, member);
  // A cgroup namespace reports paths relative to its own root.
  const suffix = relative.startsWith("..") ? member : relative;
  let path = posix.join(mount.point, suffix);
  const paths: string[] = [];
  for (let depth = 0; depth < 128; depth++) {
    paths.push(path);
    if (path === mount.point) break;
    const parent = posix.dirname(path);
    if (parent === path || !parent.startsWith(`${mount.point}/`)) break;
    path = parent;
  }
  // Include the mount root even when it is the immediate parent.
  if (!paths.includes(mount.point)) paths.push(mount.point);
  return paths;
};

const targetsFor = (membership: string, mounts: ReturnType<typeof parseMounts>) => {
  const targets: { path: string; unified: boolean; readsCpu: boolean; readsMemory: boolean }[] = [];
  for (const line of membership.split("\n")) {
    const match = /^\d+:([^:]*):(\/.*)$/.exec(line);
    if (!match) continue;
    const controllers = match[1]!.split(",");
    const member = match[2]!;
    for (const mount of mounts) {
      const unified = mount.type === "cgroup2" && match[1] === "";
      const readsCpu = unified || (controllers.includes("cpu") && mount.controllers.includes("cpu"));
      const readsMemory = unified || (controllers.includes("memory") && mount.controllers.includes("memory"));
      if (!readsCpu && !readsMemory) continue;
      targets.push(...ancestors(mount, member).map((path) => ({ path, unified, readsCpu, readsMemory })));
    }
  }
  return targets;
};

type Read = (path: string) => Promise<string | undefined>;
const readCpu = async (read: Read, path: string, unified: boolean) => {
  const [quotaText, periodText] = unified
    ? ((await read(`${path}/cpu.max`))?.trim().split(/\s+/) ?? [])
    : await Promise.all([read(`${path}/cpu.cfs_quota_us`), read(`${path}/cpu.cfs_period_us`)]);
  const quota = finite(quotaText);
  const period = finite(periodText);
  if (quota !== undefined && period !== undefined && period > 0) return quota / period;
  return undefined;
};
const readMemory = async (read: Read, path: string, unified: boolean) => {
  const [limitText, usageText] = await Promise.all([
    read(`${path}/${unified ? "memory.max" : "memory.limit_in_bytes"}`),
    read(`${path}/${unified ? "memory.current" : "memory.usage_in_bytes"}`),
  ]);
  const limit = finite(limitText);
  const usage = finite(usageText);
  if (limit !== undefined && usage !== undefined) return Math.max(0, limit - usage);
  return undefined;
};

// A delegated child can be tighter than its mount root. Parent headroom also
// includes siblings, so checking only this process's leaf is insufficient.
export const readCgroupCapacity = async (systemRoot = "/") => {
  const read = (path: string) => readFile(join(systemRoot, path), "utf8").catch(() => undefined);
  const [membership, mountInfo] = await Promise.all([read("/proc/self/cgroup"), read("/proc/self/mountinfo")]);
  const targets = targetsFor(membership ?? "", parseMounts(mountInfo ?? ""));
  let cpu: number | undefined;
  let memory: number | undefined;
  const observations: string[] = [];
  const readings = await Promise.all(
    targets.map(async (target) => {
      const [cpu, memory] = await Promise.all([
        target.readsCpu ? readCpu(read, target.path, target.unified) : undefined,
        target.readsMemory ? readMemory(read, target.path, target.unified) : undefined,
      ]);
      return { cpu, memory };
    }),
  );
  for (const reading of readings) {
    cpu = minimum(cpu, reading.cpu);
    memory = minimum(memory, reading.memory);
  }
  if (cpu === undefined) observations.push("CPU quota unavailable or unlimited; using process affinity.");
  if (memory === undefined)
    observations.push("Container memory headroom unavailable or unlimited; using system free memory.");
  return { cpu, memory, observations };
};
