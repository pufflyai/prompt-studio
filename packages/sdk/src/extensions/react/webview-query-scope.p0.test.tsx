import { expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { GuestHost } from "../guest-host";
import { createWebviewQueryClient } from "../webview-query";
import { useWebviewQuery } from "./scoped-query";

test("webview queries select host project/authority, reuse warm projects and purge revoked owners", async () => {
  const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let props = {
    projectId: "a",
    queryScope: { runtimeId: "scope", accountId: "one", accountOrigin: "manager" },
    theme: "light",
  };
  const propsListeners = new Set<() => void>();
  const events = new Set<(event: unknown) => void>();
  const host = {
    extensionId: "example",
    propsStore: {
      get: () => props,
      subscribe: (listener: () => void) => {
        propsListeners.add(listener);
        return () => {
          propsListeners.delete(listener);
        };
      },
    },
    onEvent: (_scope: string, listener: (event: unknown) => void) => {
      events.add(listener);
      return () => {
        events.delete(listener);
      };
    },
  } as unknown as GuestHost;
  const root = createWebviewQueryClient(host);
  const calls: string[] = [];
  let current: ReturnType<typeof useWebviewQuery<string>>;
  let renders = 0;
  const descriptor = {
    id: "scoped",
    events: [{ kind: "event" as const, id: "changed" }],
    read: () => {
      const value = `${props.projectId}/${props.queryScope.accountId}/${props.queryScope.accountOrigin}`;
      calls.push(value);
      return value;
    },
  };
  const Probe = () => {
    renders++;
    current = useWebviewQuery(root, descriptor);
    return <span>{current.data}</span>;
  };
  let renderer: ReactTestRenderer | undefined;
  const update = async (next: typeof props) => {
    await act(async () => {
      props = next;
      for (const listener of propsListeners) listener();
    });
  };
  try {
    await act(async () => {
      renderer = create(<Probe />);
    });
    const initial = current!.query;
    const beforeTheme = renders;
    await update({ ...props, theme: "dark" });
    expect(renders).toBe(beforeTheme);
    await update({ ...props, projectId: "b" });
    expect(current!.data).toBe("b/one/manager");
    await update({ ...props, projectId: "a" });
    expect(current!.data).toBe("a/one/manager");
    expect(calls).toHaveLength(2);
    await update({ ...props, queryScope: { ...props.queryScope, accountId: "two" } });
    expect(initial.getSnapshot().data).toBeUndefined();
    expect(current!.data).toBe("a/two/manager");
    await update({ ...props, queryScope: { ...props.queryScope, accountOrigin: "other manager" } });
    expect(current!.data).toBe("a/two/other manager");
    expect(calls).toHaveLength(4);
  } finally {
    await act(async () => renderer?.unmount());
    root.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
  expect(events.size).toBe(0);
  expect(propsListeners.size).toBe(0);
});
