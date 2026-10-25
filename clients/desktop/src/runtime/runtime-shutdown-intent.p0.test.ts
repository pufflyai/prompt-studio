import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopRuntimeManager } from "./runtime-manager";

const descriptor = {
  schemaVersion: 1 as const,
  protocolVersion: 1 as const,
  pid: 1234,
  instanceId: "attached-runtime",
  ownerType: "persistent" as const,
  origin: "http://127.0.0.1:43127" as const,
  token: "runtime-secret",
  appVersion: "0.43.1",
  startedAt: "2026-10-16T08:00:00.000Z",
};

const withAttachment = async (
  run: (attachment: {
    stop: (instanceId: string) => void;
    disconnect: () => void;
    exit: () => void;
    closeDuringProbe: () => void;
    intentional: () => number;
    failures: string[];
  }) => void,
  priorShutdown?: string,
  shutdownsDuringDiscovery: string[] = [],
) => {
  const home = mkdtempSync(join(tmpdir(), "desktop-shutdown-intent-"));
  const descriptorPath = join(home, "runtime.json");
  const stop = (instanceId: string) =>
    writeFileSync(`${descriptorPath}.shutdown`, JSON.stringify({ pid: descriptor.pid, instanceId }));
  if (priorShutdown) stop(priorShutdown);
  let alive = true;
  let closeDuringProbe = false;
  let disconnected = () => {};
  let intentional = 0;
  const failures: string[] = [];
  const manager = new DesktopRuntimeManager(
    {
      descriptorPath,
      resolveSidecarPath: () => "/unused",
      onIntentionalShutdown: () => {
        intentional += 1;
      },
      onUnexpectedExit: (detail) => failures.push(detail),
      onPhase() {},
    },
    {
      discoverRuntime: async () => {
        for (const instanceId of shutdownsDuringDiscovery) stop(instanceId);
        return { state: "healthy", descriptor };
      },
      isRuntimePidAlive: () => {
        if (closeDuringProbe) {
          stop(descriptor.instanceId);
          alive = false;
        }
        return alive;
      },
      observeRuntimeShutdown: async (_descriptor, _shutdown, _fetch, _signal, onDisconnect) => {
        disconnected = onDisconnect!;
      },
    },
  );
  try {
    await manager.start();
    run({
      stop,
      disconnect: () => disconnected(),
      exit: () => {
        alive = false;
      },
      closeDuringProbe: () => {
        closeDuringProbe = true;
      },
      intentional: () => intentional,
      failures,
    });
  } finally {
    await manager.detach();
    rmSync(home, { recursive: true, force: true });
  }
};

test("a missed shutdown event closes desktop instead of restarting the dead attachment", async () => {
  await withAttachment((runtime) => {
    runtime.disconnect();
    runtime.stop(descriptor.instanceId);
    runtime.exit();
    runtime.disconnect();
    runtime.disconnect();
    expect(runtime.intentional()).toBe(1);
    expect(runtime.failures).toEqual([]);
  });
});

test("shutdown intent is observed while the backend is still closing", async () => {
  await withAttachment((runtime) => {
    runtime.stop(descriptor.instanceId);
    runtime.disconnect();
    expect(runtime.intentional()).toBe(1);
    expect(runtime.failures).toEqual([]);
  });
});

test("shutdown published immediately before the dead PID observation is not mistaken for a crash", async () => {
  await withAttachment((runtime) => {
    runtime.closeDuringProbe();
    runtime.disconnect();
    expect(runtime.intentional()).toBe(1);
    expect(runtime.failures).toEqual([]);
  });
});

test("later replacement shutdowns cannot erase a disconnected desktop's shutdown intent", async () => {
  await withAttachment((runtime) => {
    runtime.stop(descriptor.instanceId);
    runtime.stop("replacement-runtime");
    runtime.exit();
    runtime.disconnect();
    expect(runtime.intentional()).toBe(1);
    expect(runtime.failures).toEqual([]);
  });
});

test("a fresh attachment ignores an earlier runtime's shutdown receipt", async () => {
  await withAttachment((runtime) => {
    runtime.exit();
    runtime.disconnect();
    expect(runtime.intentional()).toBe(0);
    expect(runtime.failures).toHaveLength(1);
  }, "previous-runtime");
});

test("attaching after shutdown announcement still recognizes the matching intent", async () => {
  await withAttachment((runtime) => {
    runtime.exit();
    runtime.disconnect();
    expect(runtime.intentional()).toBe(1);
    expect(runtime.failures).toEqual([]);
  }, descriptor.instanceId);
});

test("shutdowns during asynchronous discovery are not absorbed into the attachment baseline", async () => {
  await withAttachment(
    (runtime) => {
      runtime.exit();
      runtime.disconnect();
      expect(runtime.intentional()).toBe(1);
      expect(runtime.failures).toEqual([]);
    },
    "previous-runtime",
    [descriptor.instanceId, "replacement-runtime"],
  );
});

test("an owned backend with a missed shutdown event does not restart if teardown exits nonzero", async () => {
  const home = mkdtempSync(join(tmpdir(), "owned-shutdown-intent-"));
  const descriptorPath = join(home, "runtime.json");
  const child = Object.assign(new EventEmitter(), { kill: () => true, readOutput: () => "" });
  let spawned = false;
  let intentional = 0;
  const failures: string[] = [];
  const manager = new DesktopRuntimeManager(
    {
      descriptorPath,
      resolveSidecarPath: () => "/app/pstdio",
      onIntentionalShutdown: () => {
        intentional += 1;
      },
      onUnexpectedExit: (detail) => failures.push(detail),
      onPhase() {},
    },
    {
      createInstanceId: () => descriptor.instanceId,
      discoverRuntime: async () => (spawned ? { state: "healthy", descriptor } : { state: "missing" }),
      existsSync: () => true,
      resolveEnvironment: async () => ({}),
      observeRuntimeShutdown: async () => {},
      spawn: () => {
        spawned = true;
        return child;
      },
    },
  );
  try {
    await manager.start();
    writeFileSync(
      `${descriptorPath}.shutdown`,
      JSON.stringify({ pid: descriptor.pid, instanceId: descriptor.instanceId }),
    );
    child.emit("exit", 1, null);
    expect(intentional).toBe(1);
    expect(failures).toEqual([]);
  } finally {
    await manager.detach();
    rmSync(home, { recursive: true, force: true });
  }
});
