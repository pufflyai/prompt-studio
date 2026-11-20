import { expect, test } from "bun:test";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, getWorkbenchRenderers, type KanbanRendererQueryState } from "../../../core";
import { WorkbenchKanbanView } from "./kanban-view";

test("a board outside Main queries with its placement's resource", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const core = createWorkbench();
  const queried: KanbanRendererQueryState["resource"][] = [];
  const renderers = getWorkbenchRenderers(core);
  renderers.registerKanbanRenderer({
    id: "history",
    title: "Session history",
    presentation: "resourceList",
    attributes: [],
    executeQuery: (state) => {
      queried.push(state.resource);
      return [];
    },
  });
  const workspace = { type: "workspace", id: "laptop" };
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <ChakraProvider value={psTheme}>
          <WorkbenchKanbanView
            workbench={core}
            contribution={renderers.getKanbanRenderer("history")!}
            placement={{ instanceId: "side-history", panelId: "history", closable: false, resource: workspace }}
            Renderer={() => null}
          />
        </ChakraProvider>,
      );
    });
    expect(queried).toEqual([workspace]);
  } finally {
    await act(async () => tree?.unmount());
    await core.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
