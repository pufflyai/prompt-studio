import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readCgroupCapacity } from "./cgroup-capacity";

const fixture = async (files: Record<string, string>) => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-cgroup-"));
  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
  return { read: () => readCgroupCapacity(root), dispose: () => rm(root, { recursive: true, force: true }) };
};

test("respects nested cgroup v2 limits and headroom in every ancestor", async () => {
  const system = await fixture({
    "proc/self/cgroup": "0::/users/session/runtime\n",
    "proc/self/mountinfo": "29 23 0:26 / /sys/fs/cgroup rw - cgroup2 cgroup rw\n",
    "sys/fs/cgroup/cpu.max": "400000 100000\n",
    "sys/fs/cgroup/memory.max": "2147483648\n",
    "sys/fs/cgroup/memory.current": "2013265920\n",
    "sys/fs/cgroup/users/cpu.max": "200000 100000\n",
    "sys/fs/cgroup/users/session/cpu.max": "150000 100000\n",
    "sys/fs/cgroup/users/session/runtime/cpu.max": "max 100000\n",
    "sys/fs/cgroup/users/session/runtime/memory.max": "1073741824\n",
    "sys/fs/cgroup/users/session/runtime/memory.current": "268435456\n",
  });
  try {
    expect(await system.read()).toMatchObject({ cpu: 1.5, memory: 128 * 1024 ** 2 });
  } finally {
    await system.dispose();
  }
});

test("resolves separate v1 controller mounts and mount roots", async () => {
  const system = await fixture({
    "proc/self/cgroup": "2:cpu,cpuacct:/tenant/api\n3:memory:/tenant/api\n",
    "proc/self/mountinfo":
      "29 23 0:26 /tenant /sys/fs/cgroup/cpu rw - cgroup cgroup rw,cpu,cpuacct\n" +
      "30 23 0:27 /tenant /sys/fs/cgroup/memory rw - cgroup cgroup rw,memory\n",
    "sys/fs/cgroup/cpu/api/cpu.cfs_quota_us": "50000\n",
    "sys/fs/cgroup/cpu/api/cpu.cfs_period_us": "100000\n",
    "sys/fs/cgroup/memory/api/memory.limit_in_bytes": "536870912\n",
    "sys/fs/cgroup/memory/api/memory.usage_in_bytes": "0\n",
  });
  try {
    expect(await system.read()).toMatchObject({ cpu: 0.5, memory: 512 * 1024 ** 2 });
  } finally {
    await system.dispose();
  }
});

test("supports a namespace root and escaped mount paths", async () => {
  const system = await fixture({
    "proc/self/cgroup": "0::/\n",
    "proc/self/mountinfo": "29 23 0:26 /tenant /sys/fs/cgroup\\040space rw - cgroup2 cgroup rw\n",
    "sys/fs/cgroup space/cpu.max": "25000 100000\n",
    "sys/fs/cgroup space/memory.max": "134217728\n",
    "sys/fs/cgroup space/memory.current": "134217728\n",
  });
  try {
    expect(await system.read()).toMatchObject({ cpu: 0.25, memory: 0 });
  } finally {
    await system.dispose();
  }
});

test("records missing observations instead of treating unavailable measurements as zero", async () => {
  const system = await fixture({});
  try {
    const capacity = await system.read();
    expect(capacity.cpu).toBeUndefined();
    expect(capacity.memory).toBeUndefined();
    expect(capacity.observations.length).toBeGreaterThan(0);
  } finally {
    await system.dispose();
  }
});
