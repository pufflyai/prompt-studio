import { createControlsRendererRegistry } from "./registries/renderers/controls-renderer-registry";
import { createDataTableRendererRegistry } from "./registries/renderers/data-table-renderer-registry";
import { createFileRendererRegistry } from "./registries/renderers/file-renderer-registry";
import { createKanbanRendererRegistry } from "./registries/renderers/kanban-renderer-registry";
import { createWorkbenchRendererRegistry } from "./registries/renderers/renderer-registry";
import { createTreeRendererRegistry } from "./registries/renderers/tree-renderer-registry";
import type { createWorkbenchInput, WorkbenchRenderers } from "./workbench-core-types";

export const createCoreRenderers = (input: createWorkbenchInput): WorkbenchRenderers => {
  const rendererRegistry = createWorkbenchRendererRegistry();
  return {
    ...rendererRegistry,
    ...createTreeRendererRegistry({ rendererRegistry, persistence: input.treePersistence }),
    ...createKanbanRendererRegistry({ rendererRegistry }),
    ...createDataTableRendererRegistry({ rendererRegistry }),
    ...createFileRendererRegistry({ rendererRegistry }),
    ...createControlsRendererRegistry({ rendererRegistry }),
  };
};
