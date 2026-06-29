import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { TerminalBridge, TerminalSessionAdapter, TerminalSessionError, TerminalSessionExit } from "./types";
import { type UseTerminalSessionResult, useTerminalSession } from "./use-terminal-session";

const reactTestGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const originalConsoleError = console.error;

beforeAll(() => {
  console.error = (...args) => {
    if (String(args[0]).includes("react-test-renderer is deprecated")) return;
    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((resolveValue, rejectValue) => {
    resolve = resolveValue;
    reject = rejectValue;
  });
  return { promise, resolve, reject };
};

class FakeSession implements TerminalSessionAdapter {
  readonly id = "session-1";
  readonly writes: Array<string | Uint8Array> = [];
  readonly resizes: Array<{ cols: number; rows: number }> = [];
  readonly killSignals: Array<string | undefined> = [];
  private readonly exitHandlers = new Set<(exit: TerminalSessionExit) => void>();
  private readonly errorHandlers = new Set<(error: TerminalSessionError) => void>();

  write(data: string | Uint8Array) {
    this.writes.push(data);
  }

  resize(cols: number, rows: number) {
    this.resizes.push({ cols, rows });
  }

  kill(signal?: string) {
    this.killSignals.push(signal);
  }

  onData() {
    return () => {};
  }

  onExit(handler: (exit: TerminalSessionExit) => void) {
    this.exitHandlers.add(handler);
    return () => this.exitHandlers.delete(handler);
  }

  onError(handler: (error: TerminalSessionError) => void) {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  emitExit(exit: TerminalSessionExit) {
    for (const handler of this.exitHandlers) handler(exit);
  }

  emitError(error: TerminalSessionError) {
    for (const handler of this.errorHandlers) handler(error);
  }
}

const createBridge = (session: Promise<TerminalSessionAdapter>): TerminalBridge & { openCount: number } => ({
  openCount: 0,
  openSession() {
    this.openCount += 1;
    return session;
  },
});

const request = { cwd: "/workspace", cols: 80, rows: 24 };

const HookHarness = ({
  bridge,
  killOnUnmount,
  request: requestInput = request,
  onResult,
}: {
  bridge: TerminalBridge | null;
  killOnUnmount?: boolean;
  request?: Parameters<typeof useTerminalSession>[0]["request"];
  onResult: (result: UseTerminalSessionResult) => void;
}) => {
  onResult(useTerminalSession({ bridge, request: requestInput, killOnUnmount }));
  return null;
};

describe("useTerminalSession", () => {
  test("opens a session and delivers exit and error events", async () => {
    const session = new FakeSession();
    const bridge = createBridge(Promise.resolve(session));
    let result: UseTerminalSessionResult | null = null;

    await act(async () => {
      create(<HookHarness bridge={bridge} onResult={(next) => (result = next)} />);
    });

    expect(bridge.openCount).toBe(1);
    expect(result?.session).toBe(session);
    expect(result?.status).toBe("open");

    await act(async () => session.emitExit({ code: 7, signal: "SIGTERM" }));

    expect(result?.status).toBe("exited");
    expect(result?.exit).toEqual({ code: 7, signal: "SIGTERM" });

    await act(async () => session.emitError({ message: "pty failed" }));

    expect(result?.status).toBe("error");
    expect(result?.error).toEqual({ message: "pty failed" });
  });

  test("kills a session that opens after unmount", async () => {
    const session = new FakeSession();
    const deferred = createDeferred<TerminalSessionAdapter>();
    const bridge = createBridge(deferred.promise);
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(<HookHarness bridge={bridge} onResult={() => {}} />);
    });

    await act(async () => renderer.unmount());
    await act(async () => deferred.resolve(session));

    expect(session.killSignals).toEqual([undefined]);
  });

  test("kills the open session on unmount by default", async () => {
    const session = new FakeSession();
    const bridge = createBridge(Promise.resolve(session));
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(<HookHarness bridge={bridge} onResult={() => {}} />);
    });

    await act(async () => renderer.unmount());

    expect(session.killSignals).toEqual([undefined]);
  });

  test("keeps the open session alive when killOnUnmount is false", async () => {
    const session = new FakeSession();
    const bridge = createBridge(Promise.resolve(session));
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(<HookHarness bridge={bridge} killOnUnmount={false} onResult={() => {}} />);
    });

    await act(async () => renderer.unmount());

    expect(session.killSignals).toEqual([]);
  });

  test("kills an errored active session on unmount by default", async () => {
    const session = new FakeSession();
    const bridge = createBridge(Promise.resolve(session));
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(<HookHarness bridge={bridge} onResult={() => {}} />);
    });

    await act(async () => session.emitError({ message: "transport failed" }));
    await act(async () => renderer.unmount());

    expect(session.killSignals).toEqual([undefined]);
  });

  test("surfaces open failures", async () => {
    const deferred = createDeferred<TerminalSessionAdapter>();
    const bridge = createBridge(deferred.promise);
    let result: UseTerminalSessionResult | null = null;

    await act(async () => {
      create(<HookHarness bridge={bridge} onResult={(next) => (result = next)} />);
    });

    await act(async () => deferred.reject(new Error("open failed")));

    expect(result?.session).toBeNull();
    expect(result?.status).toBe("error");
    expect(result?.error).toEqual({ message: "open failed" });
  });

  test("does not reopen when request object identity changes with the same content", async () => {
    const session = new FakeSession();
    const bridge = createBridge(Promise.resolve(session));
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <HookHarness
          bridge={bridge}
          request={{ cwd: "/workspace", env: { B: "2", A: "1" }, cols: 80, rows: 24 }}
          onResult={() => {}}
        />,
      );
    });

    await act(async () => {
      renderer.update(
        <HookHarness
          bridge={bridge}
          request={{ cwd: "/workspace", env: { A: "1", B: "2" }, cols: 80, rows: 24 }}
          onResult={() => {}}
        />,
      );
    });

    expect(bridge.openCount).toBe(1);
    expect(session.killSignals).toEqual([]);
  });

  test("reopens and cleans up when request content changes", async () => {
    const firstSession = new FakeSession();
    const secondSession = new FakeSession();
    const openedRequests: Parameters<TerminalBridge["openSession"]>[0][] = [];
    const bridge: TerminalBridge & { openCount: number } = {
      openCount: 0,
      openSession(requestInput) {
        openedRequests.push(requestInput);
        this.openCount += 1;
        return Promise.resolve(this.openCount === 1 ? firstSession : secondSession);
      },
    };
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <HookHarness bridge={bridge} request={{ cwd: "/one", cols: 80, rows: 24 }} onResult={() => {}} />,
      );
    });

    await act(async () => {
      renderer.update(
        <HookHarness bridge={bridge} request={{ cwd: "/two", cols: 100, rows: 30 }} onResult={() => {}} />,
      );
    });

    expect(bridge.openCount).toBe(2);
    expect(openedRequests).toEqual([
      { cwd: "/one", cols: 80, rows: 24 },
      { cwd: "/two", cols: 100, rows: 30 },
    ]);
    expect(firstSession.killSignals).toEqual([undefined]);
    expect(secondSession.killSignals).toEqual([]);
  });
});
