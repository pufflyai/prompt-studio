import { describe, expect, test } from "bun:test";
import { createInvocationScope } from "pstdio-extensions";
import { createProcessApi, PROCESS_OUTPUT_LIMIT_BYTES } from "./extension-process-api";

const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

const stream = (value: string) => new Response(value).body!;

// Records every child the API spawns so a test can prove the host stopped it.
const trackingSpawner = () => {
  const children: Bun.Subprocess[] = [];
  const spawner = ((command: string[], options: never) => {
    const child = Bun.spawn(command, options) as Bun.Subprocess;
    children.push(child);
    return child;
  }) as typeof Bun.spawn;
  return { children, spawner };
};

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// Counts the processes a command left behind, matched on a marker in their command line.
const survivors = async (marker: string) => {
  const listing = (await Bun.$`ps -ax -o command=`.nothrow().quiet()).stdout.toString();
  return listing.split("\n").filter((line) => line.includes(marker) && !line.includes("ps -ax")).length;
};

describe("createProcessApi", () => {
  test("hides Windows consoles for command probes", async () => {
    const calls: unknown[] = [];
    const api = createProcessApi({
      spawner: ((command: string[], options: unknown) => {
        calls.push({ command, options });
        return {
          exited: Promise.resolve(0),
          stderr: stream(""),
          stdout: stream("ok"),
        };
      }) as never,
    });

    const result = await api.run({ command: ["pstdio-probe-not-real", "--version"] });

    expect(result).toEqual({ exitCode: 0, stdout: "ok", stderr: "" });
    expect(calls).toHaveLength(1);
    expect((calls[0] as { command: string[] }).command.join(" ")).toContain("pstdio-probe-not-real");
    expect((calls[0] as { command: string[] }).command.at(-1)).toBe("--version");
    expect((calls[0] as { options: unknown }).options).toEqual(
      expect.objectContaining({ stderr: "pipe", stdout: "pipe", windowsHide: true }),
    );
  });

  test("hides Windows consoles for detached commands", async () => {
    const calls: unknown[] = [];
    const api = createProcessApi({
      spawner: ((command: string[], options: unknown) => {
        calls.push({ command, options });
        return { pid: 123, unref() {} };
      }) as never,
    });

    await expect(api.spawnDetached({ command: ["pstdio-probe-not-real", "--version"] })).resolves.toEqual({ pid: 123 });
    expect(calls).toHaveLength(1);
    expect((calls[0] as { command: string[] }).command.join(" ")).toContain("pstdio-probe-not-real");
    expect((calls[0] as { command: string[] }).command.at(-1)).toBe("--version");
    expect((calls[0] as { options: unknown }).options).toEqual(
      expect.objectContaining({ stderr: "ignore", stdout: "ignore", windowsHide: true }),
    );
  });
});

describe("process host limits", () => {
  test("stops the child at the timeout and reports the deadline", async () => {
    const { children, spawner } = trackingSpawner();
    const api = createProcessApi({ spawner });
    const start = Date.now();

    // A shell holds the output pipe open through its own children, so the host must stop
    // waiting on the pipe rather than wait for the grandchild to finish.
    await expect(api.run({ command: ["sh", "-c", "sleep 5; echo done"], timeoutMs: 200 })).rejects.toThrow(
      /timed out after 200 ms/,
    );

    expect(Date.now() - start).toBeLessThan(1500);
    expect(children).toHaveLength(1);
    await children[0].exited;
    expect(isAlive(children[0].pid)).toBe(false);
  });

  test("stops the processes the command started, not only its direct child", async () => {
    const marker = `pstdio-descendant-${process.pid}`;
    const api = createProcessApi();

    await expect(api.run({ command: ["sh", "-c", `sleep 271 ${marker} & sleep 5`], timeoutMs: 200 })).rejects.toThrow(
      /timed out/,
    );

    await Bun.sleep(200);
    expect(await survivors(marker)).toBe(0);
  });

  test("stops the child and names the limit when output passes the host cap", async () => {
    const { children, spawner } = trackingSpawner();
    const api = createProcessApi({ spawner });

    await expect(
      api.run({ command: ["sh", "-c", `yes pstdio | head -c ${PROCESS_OUTPUT_LIMIT_BYTES * 2}`] }),
    ).rejects.toThrow(/exceeded the 8 MiB output limit/);

    await children[0].exited;
    expect(isAlive(children[0].pid)).toBe(false);
  });

  test("settles a pending run and stops the child when the invocation is cancelled", async () => {
    const controller = new AbortController();
    const { children, spawner } = trackingSpawner();
    const scope = createInvocationScope({ logger: silentLogger, parent: controller.signal });
    const api = createProcessApi({ scope, spawner });

    const pending = api.run({ command: ["sh", "-c", "sleep 5; echo done"] });
    await Bun.sleep(50);
    controller.abort(new Error("invocation cancelled"));

    await expect(pending).rejects.toThrow("invocation cancelled");
    await children[0].exited;
    expect(isAlive(children[0].pid)).toBe(false);
  });

  test("stops a child the command left running when its invocation ends", async () => {
    const { children, spawner } = trackingSpawner();
    const scope = createInvocationScope({ logger: silentLogger });
    const api = createProcessApi({ scope, spawner });

    // A handler that returns without awaiting run() leaves the child to the host.
    const abandoned = api.run({ command: ["sh", "-c", "sleep 5; echo done"] });
    await Bun.sleep(50);
    await scope.close();

    await expect(abandoned).rejects.toThrow("Invocation ended while the command was still running.");
    await children[0].exited;
    expect(isAlive(children[0].pid)).toBe(false);
  });

  test("returns normal output well under the host cap", async () => {
    const api = createProcessApi();

    const result = await api.run({ command: ["sh", "-c", "printf 'ready'"] });

    expect(result).toEqual({ exitCode: 0, stdout: "ready", stderr: "" });
  });
});

test.each(["close", "abort"])("does not spawn after %s while its workspace is being resolved", async (end) => {
  for (const method of ["run", "spawnDetached"] as const) {
    const controller = new AbortController();
    const scope = createInvocationScope({ logger: silentLogger, parent: controller.signal });
    const { children, spawner } = trackingSpawner();
    let finish: (path: string) => void = () => {};
    const cwd = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const api = createProcessApi({ scope, spawner, resolveCwd: () => cwd });
    const pending = api[method]({ command: ["bun", "-e", "console.log('late')"] });
    if (end === "close") await scope.close();
    else controller.abort(new Error("Cancelled"));
    finish(process.cwd());
    await expect(pending).rejects.toThrow();
    expect(children).toHaveLength(0);
    await scope.close();
  }
});

test("never starts a process after its invocation closes between promise continuations", async () => {
  for (const method of ["run", "spawnDetached"] as const) {
    const scope = createInvocationScope({ logger: silentLogger });
    const tracked = trackingSpawner();
    let closed = false;
    const startedAfterClosure: boolean[] = [];
    const spawner = ((command: string[], options: never) => {
      startedAfterClosure.push(closed);
      return tracked.spawner(command, options);
    }) as typeof Bun.spawn;
    const api = createProcessApi({ scope, spawner, resolveCwd: () => Promise.resolve(process.cwd()) });
    const pending = api[method]({ command: ["bun", "-e", "console.log('late')"] });
    queueMicrotask(() => {
      closed = true;
      void scope.close();
    });
    await pending.catch(() => undefined);
    expect(startedAfterClosure).not.toContain(true);
    await Promise.all(tracked.children.map((child) => child.exited));
  }
});
