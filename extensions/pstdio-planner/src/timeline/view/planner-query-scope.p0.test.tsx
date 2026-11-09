import { afterEach, beforeEach, expect, test } from "bun:test";
import { createWebviewClient, createWebviewQueryClient, type GuestHost } from "@pstdio/sdk/extensions";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useAutoBuild } from "./use-auto-build";
import { type PlanClient, usePlan } from "./use-plan";

const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
beforeEach(() => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: Object.assign(new EventTarget(), { hidden: false }),
  });
});
afterEach(() => {
  if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
  else Reflect.deleteProperty(globalThis, "document");
});

const fixture = () => {
  let props = { projectId: "a", queryScope: { runtimeId: "planner", accountId: "one" } };
  const listeners = new Set<() => void>(),
    events = new Set<(event: unknown) => void>();
  const calls: string[] = [];
  let pending: ReturnType<typeof Promise.withResolvers<unknown>>;
  const host = {
    extensionId: "pstdio.pstdio-planner",
    propsStore: {
      get: () => props,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    onEvent: (_scope: string, listener: (event: unknown) => void) => {
      events.add(listener);
      return () => {
        events.delete(listener);
      };
    },
    call: async (_method: string, input: { commandId: string }) => {
      const scope = `${props.projectId}/${props.queryScope.accountId}`;
      calls.push(`${scope}:${input.commandId}`);
      const value = input.commandId.endsWith(".auto-build.configure")
        ? await pending.promise
        : { projectId: scope, prompt: scope, enabled: false, sessions: [], capacity: { running: 0, limit: 1 } };
      return { outcome: { ok: true, status: "success", value } };
    },
  } as unknown as GuestHost;
  return {
    host,
    calls,
    listeners,
    events,
    hold: () => {
      pending = Promise.withResolvers();
      return pending;
    },
    select: async (projectId: string, accountId = "one") =>
      act(async () => {
        props = { projectId, queryScope: { ...props.queryScope, accountId } };
        for (const listener of listeners) listener();
      }),
  };
};

test("the production timeline hook follows project props and reuses a clean warm plan", async () => {
  const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const f = fixture();
  let latest: ReturnType<typeof usePlan>;
  const Probe = () => {
    latest = usePlan(f.host);
    return <span>{latest.plan?.projectId}</span>;
  };
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(<Probe />);
    });
    expect(latest!.plan?.projectId).toBe("a/one");
    await f.select("b");
    expect(latest!.plan?.projectId).toBe("b/one");
    await f.select("a");
    expect(latest!.plan?.projectId).toBe("a/one");
    expect(f.calls).toHaveLength(2);
  } finally {
    await act(async () => tree?.unmount());
    createWebviewQueryClient(f.host).dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
  expect(f.listeners.size).toBe(0);
  expect(f.events.size).toBe(0);
});

for (const boundary of ["project", "account"])
  test(`a held auto-build action cannot publish its error into a replacement ${boundary}`, async () => {
    const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    const f = fixture(),
      client = createWebviewClient(f.host) as PlanClient;
    let latest: ReturnType<typeof useAutoBuild>;
    const Probe = () => {
      latest = useAutoBuild(client);
      return <span>{latest.mode?.prompt}</span>;
    };
    let tree: ReactTestRenderer | undefined;
    const reply = f.hold();
    let action: Promise<boolean>;
    try {
      await act(async () => {
        tree = create(<Probe />);
      });
      await act(async () => {
        action = latest.configure(true, "old");
      });
      expect(latest!.saving).toBe(true);
      await f.select(boundary === "project" ? "b" : "a", boundary === "account" ? "two" : "one");
      expect(latest!.mode?.prompt).toBe(boundary === "project" ? "b/one" : "a/two");
      expect(latest!.saving).toBe(false);
      reply.reject(new Error("Old scope failed"));
      await act(async () => {
        expect(await action).toBe(false);
      });
      expect(latest!.error).toBeUndefined();
      expect(latest!.saving).toBe(false);
    } finally {
      reply.resolve({});
      await act(async () => tree?.unmount());
      client.queries.dispose();
      environment.IS_REACT_ACT_ENVIRONMENT = previous;
    }
    expect(f.listeners.size).toBe(0);
    expect(f.events.size).toBe(0);
  });
