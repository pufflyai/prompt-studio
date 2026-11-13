import { afterEach, beforeEach, expect, test } from "bun:test";
import { createWebviewClient } from "@pstdio/sdk/extensions";
import {
  type PlanClient,
  type TicketRequestsClient,
  useAutoBuild,
  usePlan,
  useTicketRequests,
} from "pstdio-planner/testing";
import { Activity, createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

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
  const calls: string[] = [];
  let account = "one";
  let pending: ReturnType<typeof Promise.withResolvers<unknown>>;
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.pstdio-planner",
    async execute(command, _signal, project) {
      const scope = project + "/" + account;
      calls.push(scope + ":" + command.commandId);
      if (command.commandId.endsWith(".auto-build.configure")) return await pending.promise;
      return {
        projectId: scope,
        revision: scope,
        prompt: scope,
        enabled: false,
        state: "stopped",
        blockOnReview: false,
        eligible: { conjunction: "and", rules: [] },
        requireMergedDependencies: true,
        sessions: [],
        capacity: { running: 0, limit: 1 },
      };
    },
  });
  const frame = transport.frame("a");
  frame.authority(account, "https://manager.test");
  return {
    host: frame.host,
    calls,
    listeners: {
      get size() {
        return [...frame.listeners.values()].reduce((sum, group) => sum + group.size, 0);
      },
    },
    hold: () => {
      pending = Promise.withResolvers();
      return pending;
    },
    select: async (projectId: string, nextAccount = "one") =>
      act(async () => {
        frame.project(projectId);
        if (account !== nextAccount) {
          account = nextAccount;
          frame.authority(account, "https://manager.test");
        }
      }),
    dispose: () => {
      transport.dispose();
    },
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
    latest!.client.queries.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
  expect(f.listeners.size).toBe(0);
  f.dispose();
});

for (const boundary of ["project", "account", "Activity"])
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
        tree = create(createElement(Activity, { mode: "visible" }, createElement(Probe)));
      });
      const oldConfigure = latest!.configure;
      await act(async () => {
        action = latest.configure(true, "old");
      });
      expect(latest!.saving).toBe(true);
      if (boundary === "Activity") {
        await act(async () => {
          tree!.update(createElement(Activity, { mode: "hidden" }, createElement(Probe)));
        });
        await act(async () => {
          tree!.update(createElement(Activity, { mode: "visible" }, createElement(Probe)));
        });
      } else await f.select(boundary === "project" ? "b" : "a", boundary === "account" ? "two" : "one");
      const expectedScope = { project: "b/one", account: "a/two", Activity: "a/one" }[boundary];
      expect(latest!.mode?.prompt).toBe(expectedScope);
      expect(latest!.saving).toBe(false);
      const before = f.calls.length;
      expect(await oldConfigure(true, "stale callback")).toBe(false);
      expect(f.calls).toHaveLength(before);
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
    f.dispose();
  });

test("an acknowledged auto-build configuration survives Activity hide and return after catch-up fails", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let failed = false;
  const base = {
    projectId: "selected",
    revision: "before",
    prompt: "before",
    enabled: false,
    state: "stopped",
    blockOnReview: false,
    eligible: { conjunction: "and", rules: [] },
    requireMergedDependencies: true,
    sessions: [],
    capacity: { running: 0, limit: 1 },
  };
  const saved = { ...base, revision: "accepted", enabled: true, state: "running", prompt: "saved choice" };
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.pstdio-planner",
    execute: async (command) => {
      if (command.commandId.endsWith(".auto-build.configure")) {
        failed = true;
        return saved;
      }
      if (failed) throw new Error("Catch-up unavailable");
      return base;
    },
  });
  const frame = transport.frame(),
    client = createWebviewClient(frame.host) as PlanClient;
  let latest: ReturnType<typeof useAutoBuild>, tree: ReactTestRenderer | undefined;
  const Probe = () => {
    latest = useAutoBuild(client);
    return <span>{latest.mode?.prompt}</span>;
  };
  const content = (mode: "visible" | "hidden") => (
    <Activity mode={mode}>
      <Probe />
    </Activity>
  );
  try {
    await act(async () => {
      tree = create(content("visible"));
    });
    await act(async () => {
      expect(await latest.configure(true, "saved choice")).toBe(true);
    });
    expect(latest!.mode?.prompt).toBe("saved choice");
    expect(latest!.readError?.message).toBe("Catch-up unavailable");
    await act(async () => {
      tree!.update(content("hidden"));
    });
    await act(async () => {
      tree!.update(content("visible"));
    });
    expect(latest!.mode?.prompt).toBe("saved choice");
    expect(latest!.saving).toBe(false);
    expect(latest!.error).toBeUndefined();
  } finally {
    await act(async () => {
      tree?.unmount();
    });
    client.queries.dispose();
    transport.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("ticket review requests use a retained resource query and retire callbacks with project and visibility", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const calls: { id: string; project: string; ticket?: unknown }[] = [];
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.pstdio-planner",
    execute: async (command, _signal, project) => {
      calls.push({ id: command.commandId, project, ticket: command.params?.ticket });
      return { requests: [], errors: [] };
    },
  });
  const frame = transport.frame("first");
  frame.props.resource = { type: "ticket", id: "shared-id" };
  const client = createWebviewClient(frame.host) as TicketRequestsClient;
  let latest: ReturnType<typeof useTicketRequests>;
  const Probe = () => {
    latest = useTicketRequests(client, frame.props.resource!);
    return null;
  };
  const content = (mode: "visible" | "hidden") => (
    <Activity mode={mode}>
      <Probe />
    </Activity>
  );
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(content("visible"));
    });
    const first = latest!.openChat;
    expect(calls).toEqual([
      { id: "pstdio.pstdio-planner.command.review-requests.list", project: "first", ticket: "shared-id" },
    ]);
    await act(async () => {
      frame.project("second");
    });
    expect(calls.at(-1)).toEqual({
      id: "pstdio.pstdio-planner.command.review-requests.list",
      project: "second",
      ticket: "shared-id",
    });
    const count = calls.length;
    await first("old-request");
    expect(calls).toHaveLength(count);
    const second = latest!.openChat;
    await second("current-request");
    expect(calls.at(-1)?.project).toBe("second");
    expect(calls.at(-1)?.id).toBe("pstdio.pstdio-planner.command.review-requests.open");
    await act(async () => {
      tree!.update(content("hidden"));
    });
    const hiddenCount = calls.length;
    await second("hidden-request");
    expect(calls).toHaveLength(hiddenCount);
    await act(async () => {
      tree!.update(content("visible"));
    });
    const current = latest!.openChat;
    await current("returned-request");
    expect(calls.at(-1)?.id).toBe("pstdio.pstdio-planner.command.review-requests.open");
  } finally {
    await act(async () => {
      tree?.unmount();
    });
    createWebviewClient(frame.host).queries.dispose();
    transport.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
