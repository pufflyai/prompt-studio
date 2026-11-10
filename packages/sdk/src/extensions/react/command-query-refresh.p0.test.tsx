import { expect, test } from "bun:test";
import type { WebviewCommandQuerySnapshot } from "pstdio-api-contracts/extension-kernel";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { GuestHost } from "../guest-host";
import { createWebviewClient } from "../webview-client";
import { useWebviewCommandQuery } from "./scoped-query";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const snapshot = (version: number, data = "Initial"): WebviewCommandQuerySnapshot => ({
  generation: 1,
  version,
  data,
  stale: false,
  fetching: false,
});

test.each([
  "hide",
  "rebind",
  "unmount",
] as const)("%s cancels a hook Retry while preserving an explicit peer reader and observation", async (mode) => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const calls: { operation: string; requestId: string }[] = [];
  const pending = new Map<string, ReturnType<typeof Promise.withResolvers<WebviewCommandQuerySnapshot>>>();
  const host = {
    extensionId: "example.tool",
    propsStore: {
      get: () => ({ projectId: "project", commandQueries: { owner: "authority", values: [] } }),
      subscribe: () => () => {},
    },
    onEvent: () => () => {},
    call: async (_method: string, request: { operation: string; requestId: string }) => {
      calls.push(request);
      if (request.operation === "observe") return snapshot(1);
      if (request.operation === "close") return;
      const reply = Promise.withResolvers<WebviewCommandQuerySnapshot>();
      pending.set(request.requestId, reply);
      return reply.promise;
    },
  } as unknown as GuestHost;
  const client = createWebviewClient(host);
  const ref = { kind: "command", extensionId: "example.tool", id: "read" } as const;
  const query = client.queries.command(ref, { id: "first" });
  const replacement = client.queries.command(ref, { id: "replacement" });
  const stopPeer = query.subscribe(() => {});
  let retry!: () => unknown;
  const Capture = ({ active, replaced = false }: { active: boolean; replaced?: boolean }) => {
    retry = useWebviewCommandQuery(replaced ? replacement : query, active).refresh;
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  let uiResult: unknown;
  let peerRead: Promise<unknown> | undefined;
  try {
    await act(async () => {
      renderer = create(<Capture active />);
    });
    const observation = calls.find((call) => call.operation === "observe")!;
    await act(async () => {
      uiResult = retry();
      if (uiResult instanceof Promise) void uiResult.catch(() => {});
      peerRead = query.read();
      await turn();
    });
    const previousRetry = retry;
    const refresh = calls.find((call) => call.operation === "refresh")!;
    const read = calls.find((call) => call.operation === "read")!;
    await act(async () => {
      if (mode === "unmount") {
        renderer!.unmount();
        renderer = undefined;
      } else renderer!.update(<Capture active={mode !== "hide"} replaced={mode === "rebind"} />);
    });
    expect(calls.some((call) => call.operation === "close" && call.requestId === refresh.requestId)).toBe(true);
    expect(calls.some((call) => call.operation === "close" && call.requestId === read.requestId)).toBe(false);
    expect(calls.some((call) => call.operation === "close" && call.requestId === observation.requestId)).toBe(false);
    previousRetry();
    expect(calls.filter((call) => call.operation === "refresh")).toHaveLength(1);
    await act(async () => {
      pending.get(refresh.requestId)!.resolve(snapshot(2, "Late hidden response"));
      await turn();
    });
    expect(query.getSnapshot().data).toBe("Initial");
    expect(query.getSnapshot().error).toBeUndefined();
    await act(async () => {
      pending.get(read.requestId)!.resolve(snapshot(3, "Peer accepted"));
      await peerRead;
    });
    expect(query.getSnapshot().data).toBe("Peer accepted");
  } finally {
    for (const reply of pending.values()) reply.resolve(snapshot(4));
    await act(async () => renderer?.unmount());
    await Promise.allSettled([peerRead, uiResult]);
    stopPeer();
    client.queries.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
