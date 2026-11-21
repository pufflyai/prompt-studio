import { afterEach, expect, test } from "bun:test";
import type { CollectionPageRequest } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { getEnumOptions, type KanbanRendererProps } from "@pstdio/ui/kanban-renderer";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
import { registerWorkbenchExtensionKanbanRenderers } from "../../../extensions/contributions/kanban-renderer-contributions";
import { WorkbenchKanbanView } from "./kanban-view";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
let tree: ReactTestRenderer | undefined;
let workbench: ReturnType<typeof createWorkbench>;
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
  await workbench.dispose();
  environment.IS_REACT_ACT_ENVIRONMENT = previousEnvironment;
});

for (const queryMode of ["legacy", "paged"] as const) {
  for (const join of ["during load", "after load"] as const) {
    test(`${queryMode} boards retain their status columns when another placement joins ${join}`, async () => {
      environment.IS_REACT_ACT_ENVIRONMENT = true;
      workbench = createWorkbench();
      let pending = Promise.withResolvers<void>();
      let calls = 0;
      let label = "Todo";
      let includeAttributes = true;
      let clearPresentation = false;
      let returnRowArray = false;
      registerWorkbenchExtensionKanbanRenderers(
        {
          projectId: "project",
          workbench,
          executeCommand: async (_command, input) => {
            calls++;
            await pending.promise;
            const page = input.params?.page as CollectionPageRequest | undefined;
            const offset = page?.offset ?? 0;
            const rows = [
              { id: "first", title: `First ${calls}`, attributes: { status: "todo" } },
              { id: "second", title: "Second", attributes: { status: "done" } },
            ];
            if (returnRowArray) return rows;
            return {
              rows: queryMode === "paged" ? rows.slice(offset, offset + 1) : rows,
              ...(includeAttributes
                ? {
                    attributes: clearPresentation
                      ? []
                      : [
                          {
                            id: "status",
                            label: "Status",
                            groupable: true,
                            type: {
                              kind: "enum",
                              options: [
                                { value: "todo", label },
                                { value: "done", label: "Done" },
                              ],
                            },
                          },
                        ],
                  }
                : {}),
              ...(clearPresentation ? {} : { boardColumnConfigs: { todo: { canCreate: true } } }),
              ...(queryMode === "paged"
                ? {
                    page: {
                      revision: "revision",
                      cursor: offset === 0 ? "next" : null,
                      total: 2,
                      filteredTotal: 2,
                      groups: [
                        { field: "status", value: "todo", count: 1 },
                        { field: "status", value: "done", count: 1 },
                      ],
                    },
                  }
                : {}),
            };
          },
        },
        [
          {
            id: "tasks",
            extensionId: "example.tasks",
            title: "Tasks",
            queryHandlerId: "query",
            ...(queryMode === "paged" ? { queryMode } : {}),
            initialPageSize: 1,
            attributes: [{ id: "status", label: "Status", groupable: true, type: { kind: "enum", options: [] } }],
            defaultSettings: {
              viewMode: "board",
              columnGrouping: "status",
              rowGrouping: "none",
              displayProperties: [],
            },
          },
        ],
      );
      const contribution = getWorkbenchRenderers(workbench).getKanbanRenderer("tasks")!;
      const output = new Map<string, KanbanRendererProps>();
      const First = (props: KanbanRendererProps) => {
        output.set("first", props);
        return null;
      };
      const Second = (props: KanbanRendererProps) => {
        output.set("second", props);
        return null;
      };
      const Third = (props: KanbanRendererProps) => {
        output.set("third", props);
        return null;
      };
      const content = (second: boolean, first = true, third = false) => (
        <ChakraProvider value={psTheme}>
          {first ? (
            <WorkbenchKanbanView
              workbench={workbench}
              contribution={contribution}
              placement={{ instanceId: "first", panelId: "tasks", closable: false }}
              Renderer={First}
            />
          ) : null}
          {second ? (
            <WorkbenchKanbanView
              workbench={workbench}
              contribution={contribution}
              placement={{ instanceId: "second", panelId: "tasks", closable: false }}
              Renderer={Second}
            />
          ) : null}
          {third ? (
            <WorkbenchKanbanView
              workbench={workbench}
              contribution={contribution}
              placement={{ instanceId: "third", panelId: "tasks", closable: false }}
              Renderer={Third}
            />
          ) : null}
        </ChakraProvider>
      );
      await act(async () => {
        tree = create(content(join === "during load"));
      });
      await act(async () => pending.resolve());
      if (join === "after load") await act(async () => tree!.update(content(true)));
      const initialCalls = queryMode === "paged" ? 2 : 1;
      expect(calls).toBe(initialCalls);
      const expectColumns = (
        expectedLabel: string,
        ids = ["first", "second"],
        statuses = queryMode === "paged" ? ["todo"] : ["todo", "done"],
      ) => {
        for (const id of ids) {
          const props = output.get(id)!;
          expect(props.rows.map((row) => row.attributes.status)).toEqual(statuses);
          const status = props.attributes.find((field) => field.id === "status")!;
          if (status.type.kind !== "enum") throw new Error("Expected status choices");
          expect(getEnumOptions(status.type)).toEqual([
            { value: "todo", label: expectedLabel },
            { value: "done", label: "Done" },
          ]);
          expect(props.getBoardColumnConfig?.("todo").canCreate).toBe(true);
        }
      };
      expectColumns("Todo");
      label = "Ready";
      pending = Promise.withResolvers<void>();
      await act(async () => getWorkbenchRenderers(workbench).refreshKanbanRenderer("tasks"));
      expectColumns("Todo");
      expect(calls).toBe(initialCalls + 1);
      await act(async () => pending.resolve());
      expect(calls).toBe(queryMode === "paged" ? initialCalls + 2 : initialCalls + 1);
      expectColumns("Ready");
      // The peer now owns refreshes. A rows-only response retains the shared schema.
      includeAttributes = false;
      await act(async () => tree!.update(content(true, true, true)));
      expectColumns("Ready", ["third"]);
      await act(async () => tree!.update(content(false, false, true)));
      if (queryMode === "legacy") {
        // The legacy array shorthand supplies no metadata, including no rule removal.
        returnRowArray = true;
        await act(async () => getWorkbenchRenderers(workbench).refreshKanbanRenderer("tasks"));
        expectColumns("Ready", ["third"]);
        returnRowArray = false;
      }
      if (queryMode === "paged") {
        const prior = calls;
        await act(async () => output.get("third")!.page!.onLoadMore!());
        expect(calls).toBe(prior + 1);
        expectColumns("Ready", ["third"], ["todo", "done"]);
      }
      const before = calls;
      await act(async () => getWorkbenchRenderers(workbench).refreshKanbanRenderer("tasks"));
      expect(output.get("third")!.rows[0].title).toBe(`First ${calls}`);
      expect(calls).toBe(before + 1);
      expectColumns("Ready", ["third"]);
      includeAttributes = true;
      clearPresentation = true;
      await act(async () => getWorkbenchRenderers(workbench).refreshKanbanRenderer("tasks"));
      expect(output.get("third")!.attributes).toEqual([]);
      expect(output.get("third")!.getBoardColumnConfig?.("todo").canCreate).toBeUndefined();
    });
  }
}
