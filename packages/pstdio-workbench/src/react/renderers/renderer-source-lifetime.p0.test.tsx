import { afterAll, afterEach, expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { Activity } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { useRendererPages } from "./use-renderer-pages";
import { useRendererRead } from "./use-renderer-read";
import { WorkbenchConnectionProvider } from "./workbench-connection-provider";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
const queries = createScopedQueryClient({ runtimeId: "native", extensionId: "notes" });
const workbench = createWorkbench({ queries });
afterAll(async () => {
  await workbench.dispose();
  queries.dispose();
});
let renderer: ReactTestRenderer;
afterEach(async () => {
  await act(async () => renderer?.unmount());
  queries.clearScope({});
  environment.IS_REACT_ACT_ENVIRONMENT = previousEnvironment;
});

test("duplicate native views share one custom source and reconcile after their last observer leaves", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const listeners = new Set<() => void>();
  const values: Record<string, ReturnType<typeof useRendererRead<string>>> = {};
  let calls = 0;
  let server = "initial";
  const Capture = ({ name }: { name: string }) => {
    values[name] = useRendererRead({
      workbench,
      ownerKey: name,
      queryKey: "custom",
      sourceId: "custom",
      load: () => {
        calls++;
        return server;
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    });
    return null;
  };
  const content = (visible: boolean) => (
    <Activity mode={visible ? "visible" : "hidden"}>
      <Capture name="first" />
      <Capture name="second" />
    </Activity>
  );
  await act(async () => {
    renderer = create(content(true));
  });
  expect(calls).toBe(1);
  expect(listeners.size).toBe(1);
  server = "visible change";
  await act(async () => {
    for (const listener of listeners) listener();
  });
  expect(calls).toBe(2);
  expect(values.second.value).toBe(server);
  await act(async () => renderer.update(content(false)));
  expect(listeners.size).toBe(0);
  server = "hidden change";
  expect(calls).toBe(2);
  await act(async () => renderer.update(content(true)));
  expect(calls).toBe(3);
  expect(listeners.size).toBe(1);
  expect([values.first.value, values.second.value]).toEqual([server, server]);
});

test("known-feed native views reuse clean returns and reconcile once after a disconnected interval", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let calls = 0;
  let server = "before";
  const values: Record<string, ReturnType<typeof useRendererRead<string>>> = {};
  const Capture = ({ name }: { name: string }) => {
    values[name] = useRendererRead({
      workbench,
      ownerKey: name,
      queryKey: "reconnect",
      sourceId: "reconnect",
      queryEvents: ["notes.changed"],
      load: () => {
        calls++;
        return server;
      },
      subscribe: undefined,
    });
    return null;
  };
  const content = (visible: boolean, connected = true) => (
    <WorkbenchConnectionProvider connected={connected}>
      <Activity mode={visible ? "visible" : "hidden"}>
        <Capture name="one" />
        <Capture name="two" />
      </Activity>
    </WorkbenchConnectionProvider>
  );
  await act(async () => {
    renderer = create(content(true));
  });
  await act(async () => renderer.update(content(false)));
  await act(async () => renderer.update(content(true)));
  expect(calls).toBe(1);
  await act(async () => renderer.update(content(true, false)));
  server = "after reconnect";
  expect(calls).toBe(1);
  await act(async () => renderer.update(content(true)));
  expect(calls).toBe(2);
  expect([values.one.value, values.two.value]).toEqual([server, server]);
});

test("a shared save hold blocks every duplicate reader until the final accepted write settles", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const saved = Promise.withResolvers<void>();
  const values: Record<string, ReturnType<typeof useRendererRead<string>>> = {};
  let server = "before";
  let calls = 0;
  const Capture = ({ name }: { name: string }) => {
    values[name] = useRendererRead({
      workbench,
      ownerKey: name,
      queryKey: "save",
      sourceId: "save",
      subscribe: undefined,
      load: () => {
        calls++;
        return server;
      },
    });
    return null;
  };
  await act(async () => {
    renderer = create(
      <>
        <Capture name="one" />
        <Capture name="two" />
      </>,
    );
  });
  let saving: Promise<void> | undefined;
  await act(async () => {
    saving = values.one.mutate(
      () => "preview",
      () => saved.promise,
    );
  });
  await act(async () => workbench.views.reads.invalidate("save"));
  expect(calls).toBe(1);
  expect(values.one.value).toBe("preview");
  server = "after";
  await act(async () => {
    saved.resolve();
    await saving;
  });
  expect(calls).toBe(2);
  expect([values.one.value, values.two.value]).toEqual([server, server]);
});

test("native refreshes retain exact resource scope and invalidate warm inactive queries", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const registration = workbench.views.registerView({
    id: "controls",
    title: "Controls",
    body: { kind: "controls", executeQuery: () => ({}) },
  });
  const calls = { a: 0, b: 0 };
  const Capture = ({ id }: { id: "a" | "b" }) => {
    useRendererRead({
      workbench,
      ownerKey: id,
      queryKey: id,
      sourceId: "controls",
      queryScope: { projectId: "p" },
      dependency: { resourceId: id },
      subscribe: undefined,
      load: () => ++calls[id],
    });
    return null;
  };
  const content = (visible: boolean) => (
    <Activity mode={visible ? "visible" : "hidden"}>
      <Capture id="a" />
      <Capture id="b" />
    </Activity>
  );
  await act(async () => {
    renderer = create(content(true));
  });
  await act(async () => workbench.views.refreshView("controls", { projectId: "p", resourceIds: ["a"] }));
  expect(calls).toEqual({ a: 2, b: 1 });
  await act(async () =>
    getWorkbenchRenderers(workbench).refreshControlsRenderer("controls", { projectId: "other", resourceIds: ["a"] }),
  );
  expect(calls).toEqual({ a: 2, b: 1 });
  await act(async () => renderer.update(content(false)));
  getWorkbenchRenderers(workbench).refreshControlsRenderer("controls", { projectId: "p", resourceIds: ["a"] });
  expect(calls).toEqual({ a: 2, b: 1 });
  await act(async () => renderer.update(content(true)));
  expect(calls).toEqual({ a: 3, b: 1 });
  registration.dispose();
});

test("the first acknowledged writer retains its edit while a second view is still saving", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const saved = { a: Promise.withResolvers<void>(), b: Promise.withResolvers<void>() };
  const values: Record<string, ReturnType<typeof useRendererRead<{ a: number; b: number }>>> = {};
  let server = { a: 0, b: 0 };
  let calls = 0;
  const Capture = ({ name }: { name: string }) => {
    values[name] = useRendererRead({
      workbench,
      ownerKey: name,
      queryKey: "overlap",
      sourceId: "overlap",
      load: () => {
        calls++;
        return structuredClone(server);
      },
    });
    return null;
  };
  await act(async () => {
    renderer = create(
      <>
        <Capture name="a" />
        <Capture name="b" />
      </>,
    );
  });
  let first: Promise<void> | undefined;
  let second: Promise<void> | undefined;
  await act(async () => {
    first = values.a.mutate(
      (current) => ({ ...current, a: 1 }),
      () => saved.a.promise,
    );
    second = values.b.mutate(
      (current) => ({ ...current, b: 1 }),
      () => saved.b.promise,
    );
  });
  server = { a: 1, b: 0 };
  await act(async () => {
    saved.a.resolve();
    await first;
  });
  expect(calls).toBe(1);
  expect(values.a.value?.a).toBe(1);
  server = { a: 1, b: 1 };
  await act(async () => {
    saved.b.resolve();
    await second;
  });
  expect(calls).toBe(2);
  expect(values.a.value).toEqual(server);
  expect(values.b.value).toEqual(server);
});

test("paged duplicate boards restart once on changed data and on a stale hidden return", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const registration = workbench.views.registerView({
    id: "board",
    title: "Board",
    body: { kind: "kanban", attributes: [], executeQuery: () => [] },
  });
  type Row = { id: string; title: string };
  type Result = {
    rows: Row[];
    page: import("@pstdio/sdk/extensions").CollectionPage;
    position: import("@pstdio/sdk/extensions").CollectionPageRequest;
  };
  const pages: Record<string, ReturnType<typeof useRendererPages<Row>>> = {};
  const values: Record<string, ReturnType<typeof useRendererRead<Result>>> = {};
  const server = [
    { id: "a", title: "Old A" },
    { id: "b", title: "B" },
  ];
  let revision = "r1";
  let calls = 0;
  const Capture = ({ name }: { name: string }) => {
    const page = useRendererPages<Row>({
      identity: "board",
      scope: "board",
      fields: ["title"],
      rowId: (row) => row.id,
      initialPageSize: 1,
    });
    pages[name] = page;
    values[name] = useRendererRead<Result>({
      workbench,
      ownerKey: name,
      queryKey: "board",
      sourceId: "board",
      queryEvents: ["board.changed"],
      refreshKey: page.refreshKey,
      onAccept: page.accept,
      onInvalidate: page.reset,
      load: (signal) =>
        page.load(async (request) => {
          calls++;
          if (request.revision && request.revision !== revision) throw new Error("Stale revision");
          const offset = request.offset ?? 0;
          return {
            rows: structuredClone(server.slice(offset, offset + request.limit)),
            page: { revision, cursor: offset === 0 ? "more" : null, total: 2, filteredTotal: 2, groups: [] },
          };
        }, signal),
    });
    return null;
  };
  const content = (visible: boolean) => (
    <Activity mode={visible ? "visible" : "hidden"}>
      <Capture name="one" />
      <Capture name="two" />
    </Activity>
  );
  await act(async () => {
    renderer = create(content(true));
  });
  await act(async () => {
    for (const name of ["one", "two"])
      pages[name].controls(values[name].value?.page, false, true, values[name].value?.position)?.onLoadMore();
  });
  expect(calls).toBe(2);
  expect(values.two.value?.rows).toHaveLength(2);
  server[0].title = "New A";
  revision = "r2";
  await act(async () => {
    queries.invalidate({ type: "changed", id: "board.changed" });
    workbench.views.refreshView("board");
  });
  expect(calls).toBe(3);
  expect(values.two.value?.rows).toEqual([server[0]]);
  await act(async () => renderer.update(content(false)));
  server[0].title = "Hidden A";
  revision = "r3";
  workbench.views.refreshView("board");
  await act(async () => renderer.update(content(true)));
  expect(calls).toBe(4);
  expect(values.one.value?.rows).toEqual([server[0]]);
  registration.dispose();
});
