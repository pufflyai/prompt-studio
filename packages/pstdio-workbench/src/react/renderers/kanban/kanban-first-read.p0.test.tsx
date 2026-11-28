import { afterEach, expect, test } from "bun:test";
import type { CollectionPageRequest } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import type { AttributeDescriptor, KanbanRendererProps } from "@pstdio/ui/kanban-renderer";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
import { WorkbenchKanbanView } from "./kanban-view";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
let tree: ReactTestRenderer | undefined;
let core: ReturnType<typeof createWorkbench>;
const responses: Array<ReturnType<typeof Promise.withResolvers<void>>> = [];
afterEach(async () => {
  for (const response of responses.splice(0)) response.resolve();
  await act(async () => tree?.unmount());
  tree = undefined;
  await core.dispose();
  environment.IS_REACT_ACT_ENVIRONMENT = previousEnvironment;
});

const status = (options: { value: string; label: string }[]): AttributeDescriptor => ({
  id: "status",
  label: "Status",
  groupable: true,
  type: { kind: "enum", options },
});

test.each([
  { id: "tasks", expectedReads: 2 },
  { id: "pstdio.planner.view.tickets", expectedReads: 1 },
])("$id shows its first page when that page updates the declared attributes", async ({ id, expectedReads }) => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  core = createWorkbench();
  // Extension boards publish a page's attributes to the declared source before the page itself
  // reaches the board. In a browser that update renders first.
  let declared = [status([])];
  const listeners = new Set<() => void>();
  const described = [status([{ value: "todo", label: "Todo" }])];
  const requests: CollectionPageRequest[] = [];
  const countsStarted = Promise.withResolvers<void>();
  const counts = Promise.withResolvers<void>();
  responses.push(counts);
  const renderers = getWorkbenchRenderers(core);
  renderers.registerKanbanRenderer({
    id,
    title: "Tasks",
    queryScope: { projectId: "project", extensionId: "example.tasks" },
    attributes: {
      getSnapshot: () => declared,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    defaultSettings: { viewMode: "board", columnGrouping: "status", rowGrouping: "none", displayProperties: [] },
    executeQuery: () => [],
    executePage: async ({ page }) => {
      if (page.limit === 0) {
        countsStarted.resolve();
        await counts.promise;
        return {
          rows: [],
          page: { revision: "revision", cursor: null, total: 1, filteredTotal: 1, groups: [], statistics: {} },
        };
      }
      requests.push(page);
      const response = Promise.withResolvers<void>();
      responses.push(response);
      await response.promise;
      return {
        rows: [{ id: "first", title: "First", attributes: { status: "todo" } }],
        attributes: described,
        page: { revision: "revision", cursor: null, total: 1, filteredTotal: 1, groups: [] },
      };
    },
  });
  const contribution = renderers.getKanbanRenderer(id)!;
  let shown: KanbanRendererProps | undefined;
  const Renderer = (props: KanbanRendererProps) => {
    shown = props;
    return null;
  };
  await act(async () => {
    tree = create(
      <ChakraProvider value={psTheme}>
        <WorkbenchKanbanView
          workbench={core}
          contribution={contribution}
          placement={{ instanceId: "tasks", panelId: "tasks", closable: false }}
          Renderer={Renderer}
        />
      </ChakraProvider>,
    );
  });
  expect(requests).toHaveLength(1);
  expect(shown).toBeUndefined();

  await act(async () => {
    declared = described;
    for (const listener of listeners) listener();
  });
  await act(async () => responses[1].resolve());

  // The page that described the new choices must not be discarded for a second full read.
  expect(shown?.rows.map((row) => row.id)).toEqual(["first"]);
  expect(requests).toHaveLength(expectedReads);
  if (expectedReads === 2) {
    expect(requests[1].presentation?.status).toEqual({
      emptyGroup: "No status",
      options: [{ value: "todo", label: "Todo" }],
    });
    await act(async () => responses[2].resolve());
  } else {
    expect(requests[0].presentation).toBeUndefined();
    await countsStarted.promise;
    expect(shown?.page?.result?.statistics).toBeUndefined();
    await act(async () => counts.resolve());
    expect(shown?.page?.result?.statistics).toEqual({});
    await act(async () => shown?.page?.onSearchChange("Todo"));
    expect(requests[1].presentation?.status?.options).toEqual([{ value: "todo", label: "Todo" }]);
    await act(async () => responses[2].resolve());
  }
  expect(shown?.rows.map((row) => row.id)).toEqual(["first"]);
  expect(shown?.page?.loading).toBe(false);
});
