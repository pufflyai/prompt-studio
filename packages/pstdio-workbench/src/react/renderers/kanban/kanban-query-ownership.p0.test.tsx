import { afterEach, expect, test } from "bun:test";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import type { KanbanRendererProps } from "@pstdio/ui/kanban-renderer";
import { Activity } from "react";
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
  await act(async () => {
    gates.a.resolve();
    await first;
  });
  expect(calls).toBe(1);
  expect(output.a.rows[0].attributes.a).toBe(1);
  // Changing query parameters cannot bypass a peer's still-pending accepted write.
  await act(async () => output.a.page?.onSearchChange("Row"));
  expect(calls).toBe(1);
  await act(async () => {
    gates.b.resolve();
    await second;
  });
  expect(calls).toBe(3); // One reconciliation for each distinct search request.
  expect(output.a.rows[0].attributes).toEqual(server);
  expect(output.b.rows[0].attributes).toEqual(server);
  await act(async () => output.b.page?.onSearchChange("Row"));
  expect(calls).toBe(3);
  await act(async () => tree?.update(content(false)));
  renderers.refreshKanbanRenderer("shared board");
  expect(calls).toBe(3);
  await act(async () => tree?.update(content(true)));
  expect(calls).toBe(4);
});
