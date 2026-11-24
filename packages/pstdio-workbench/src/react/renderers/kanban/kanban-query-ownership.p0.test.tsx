import { afterEach, expect, test } from "bun:test";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import type { KanbanRendererProps } from "@pstdio/ui/kanban-renderer";
import { Activity, useSyncExternalStore } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
import { WorkbenchKanbanView } from "./kanban-view";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
let tree: ReactTestRenderer | undefined;
let core: ReturnType<typeof createWorkbench>;
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
  await core.dispose();
  environment.IS_REACT_ACT_ENVIRONMENT = previousEnvironment;
});

test("production duplicate boards share semantic queries while retaining independent presentation state", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  core = createWorkbench();
  const output: Record<string, KanbanRendererProps> = {};
  let calls = 0;
  const server = { a: 0, b: 0 };
  const gates = { a: Promise.withResolvers<void>(), b: Promise.withResolvers<void>() };
  const renderers = getWorkbenchRenderers(core);
  renderers.registerKanbanRenderer({
    id: "shared board",
    title: "Shared board",
    queryScope: { projectId: "p", extensionId: "notes" },
    attributes: [],
    executeQuery: () => [],
    executePage: async () => {
      calls++;
      return {
        rows: [{ id: "row", title: "Row", attributes: { ...server } }],
        page: { revision: String(calls), cursor: null, total: 1, filteredTotal: 1, groups: [] },
      };
    },
    onAttributeChange: async (_row, attribute, value) => {
      const key = attribute as "a" | "b";
      await gates[key].promise;
      server[key] = Number(value);
    },
  });
  const contribution = renderers.getKanbanRenderer("shared board")!;
  const A = (props: KanbanRendererProps) => {
    output.a = props;
    return null;
  };
  const B = (props: KanbanRendererProps) => {
    output.b = props;
    return null;
  };
  const content = (visible: boolean) => (
    <ChakraProvider value={psTheme}>
      <Activity mode={visible ? "visible" : "hidden"}>
        <WorkbenchKanbanView
          workbench={core}
          contribution={contribution}
          placement={{ instanceId: "one", panelId: "shared board", closable: false }}
          Renderer={A}
        />
        <WorkbenchKanbanView
          workbench={core}
          contribution={contribution}
          placement={{ instanceId: "two", panelId: "shared board", closable: false }}
          Renderer={B}
        />
      </Activity>
    </ChakraProvider>
  );
  await act(async () => {
    tree = create(content(true));
  });
  expect(calls).toBe(1);
  expect(output.a.storageKey).not.toBe(output.b.storageKey);
  let first = Promise.resolve<unknown>(undefined);
  let second = Promise.resolve<unknown>(undefined);
  await act(async () => {
    first = Promise.resolve(output.a.onAttributeChange?.("row", "a", 1));
    second = Promise.resolve(output.b.onAttributeChange?.("row", "b", 1));
  });
  expect(output.a.rows[0].attributes).toEqual({ a: 1, b: 1 });
  expect(output.b.rows[0].attributes).toEqual({ a: 1, b: 1 });
  await act(async () => {
    gates.a.resolve();
    await first;
  });
  // The first write crosses a fresh read barrier shared by both boards.
  expect(calls).toBe(2);
  expect(output.a.rows[0].attributes).toEqual({ a: 1, b: 1 });
  await act(async () => output.a.page?.onSearchChange("Row"));
  expect(calls).toBe(3);
  expect(output.a.rows[0].attributes.b).toBe(1);
  await act(async () => {
    gates.b.resolve();
    await second;
  });
  expect(calls).toBe(5); // One fresh read for each distinct search request.
  expect(output.a.rows[0].attributes).toEqual(server);
  expect(output.b.rows[0].attributes).toEqual(server);
  await act(async () => output.b.page?.onSearchChange("Row"));
  expect(calls).toBe(5);
  await act(async () => tree?.update(content(false)));
  renderers.refreshKanbanRenderer("shared board");
  expect(calls).toBe(5);
  await act(async () => tree?.update(content(true)));
  expect(calls).toBe(6);
});

test("create and open leaves the departing board stale until it is visible again", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  core = createWorkbench();
  const renderers = getWorkbenchRenderers(core);
  let navigation = Promise.withResolvers<void>();
  let visible = true;
  let navigate = true;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const show = (next: boolean) => {
    visible = next;
    for (const listener of listeners) listener();
  };
  let calls = 0;
  let board!: KanbanRendererProps;
  renderers.registerKanbanRenderer({
    id: "tickets",
    title: "Tickets",
    attributes: [],
    executeQuery: () => [{ id: "row", title: String(++calls), attributes: {} }],
    onCreateRow: async () => {
      renderers.refreshKanbanRenderer("tickets");
      await navigation.promise;
      if (navigate) show(false);
    },
  });
  const Renderer = (props: KanbanRendererProps) => {
    board = props;
    return null;
  };
  const Page = ({ peer = false }: { peer?: boolean }) => (
    <ChakraProvider value={psTheme}>
      <Activity mode={useSyncExternalStore(subscribe, () => visible) ? "visible" : "hidden"}>
        <WorkbenchKanbanView
          workbench={core}
          contribution={renderers.getKanbanRenderer("tickets")!}
          placement={{ instanceId: "one", panelId: "tickets", closable: false }}
          Renderer={Renderer}
        />
      </Activity>
      {peer && (
        <WorkbenchKanbanView
          workbench={core}
          contribution={renderers.getKanbanRenderer("tickets")!}
          placement={{ instanceId: "peer", panelId: "tickets", closable: false }}
          Renderer={() => null}
        />
      )}
    </ChakraProvider>
  );
  await act(async () => {
    tree = create(<Page />);
  });
  const submission = { columnId: "todo", values: {}, attributeValues: {}, files: [] };
  let createRow: Promise<void> | void;
  await act(async () => {
    createRow = board.onCreateRow!(submission);
  });
  expect(calls).toBe(1);
  await act(async () => {
    navigation.resolve();
    await createRow;
  });
  expect(calls).toBe(1);
  navigate = false;
  await act(async () => show(true));
  expect(calls).toBe(2);

  // A rejected activation leaves the original board visible and able to reconcile.
  navigation = Promise.withResolvers<void>();
  await act(async () => {
    createRow = board.onCreateRow!(submission);
  });
  expect(calls).toBe(2);
  await act(async () => {
    navigation.reject(new Error("navigation failed"));
    await expect(Promise.resolve(createRow)).rejects.toThrow("navigation failed");
  });
  expect(calls).toBe(3);

  navigation = Promise.withResolvers<void>();
  await act(async () => {
    createRow = board.onCreateRow!({ ...submission, openCreatedRow: false });
  });
  expect(calls).toBe(4);
  await act(async () => {
    navigation.resolve();
    await createRow;
  });

  await act(async () => tree?.update(<Page peer />));
  navigation = Promise.withResolvers<void>();
  await act(async () => {
    createRow = board.onCreateRow!(submission);
  });
  expect(calls).toBe(5);
  await act(async () => {
    navigation.resolve();
    await createRow;
  });
  expect(calls).toBe(5);
});

test("column actions defer board reconciliation until their writes finish", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  core = createWorkbench();
  let output: KanbanRendererProps | undefined;
  let reads = 0;
  let archived = false;
  const saving = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const renderers = getWorkbenchRenderers(core);
  renderers.registerKanbanRenderer({
    id: "column action board",
    title: "Column action board",
    attributes: [],
    executeQuery: () => {
      reads++;
      return archived ? [] : [{ id: "row", title: "Row", attributes: {} }];
    },
    onColumnAction: async () => {
      renderers.refreshKanbanRenderer("column action board");
      entered.resolve();
      await saving.promise;
      archived = true;
      renderers.refreshKanbanRenderer("column action board");
    },
  });
  const Capture = (props: KanbanRendererProps) => {
    output = props;
    return null;
  };
  await act(async () => {
    tree = create(
      <ChakraProvider value={psTheme}>
        <WorkbenchKanbanView
          workbench={core}
          contribution={renderers.getKanbanRenderer("column action board")!}
          placement={{ instanceId: "column-action", panelId: "column action board", closable: false }}
          Renderer={Capture}
        />
      </ChakraProvider>,
    );
  });
  expect(reads).toBe(1);
  let action: Promise<unknown> | undefined;
  await act(async () => {
    action = Promise.resolve(output!.onColumnAction!("done", "archive"));
    await entered.promise;
  });
  const pendingReads = reads;
  await act(async () => {
    saving.resolve();
    await action;
  });
  expect(pendingReads).toBe(1);
  expect(reads).toBe(2);
  expect(output!.rows).toEqual([]);
});
