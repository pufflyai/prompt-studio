import type { ContributionMetadata } from "../../shared/contributions/metadata";
import type { ControlsRendererRegistry } from "../renderers/controls-renderer-registry";
import type { DataTableRendererRegistry } from "../renderers/data-table-renderer-registry";
import type { FileRendererRegistry } from "../renderers/file-renderer-registry";
import type { KanbanRendererRegistry } from "../renderers/kanban-renderer-registry";
import type { WorkbenchRendererRegistry } from "../renderers/renderer-registry";
import type { TreeRendererRegistry } from "../renderers/tree-renderer-registry";
import type { WorkbenchViewContribution } from "./view-registry";

type ViewBodyRegistries = Pick<WorkbenchRendererRegistry, "refreshRenderer" | "registerRenderer"> &
  Pick<TreeRendererRegistry, "refresh" | "registerTreeRenderer"> &
  Pick<KanbanRendererRegistry, "refreshKanbanRenderer" | "registerKanbanRenderer"> &
  Pick<DataTableRendererRegistry, "refreshDataTableRenderer" | "registerDataTableRenderer"> &
  Pick<FileRendererRegistry, "refreshFileRenderer" | "registerFileRenderer"> &
  Pick<ControlsRendererRegistry, "refreshControlsRenderer" | "registerControlsRenderer">;

const refreshable = <T extends { dispose(): void }>(registration: T, refresh: (input?: unknown) => void) => ({
  dispose: () => registration.dispose(),
  refresh,
});

export const createWorkbenchViewBodyRegistration =
  (registries: ViewBodyRegistries) => (view: WorkbenchViewContribution, metadata?: ContributionMetadata) => {
    const body = view.body;
    if (body.kind === "react") {
      return refreshable(registries.registerRenderer({ id: view.id, render: body.render }), () =>
        registries.refreshRenderer(view.id),
      );
    }
    if (body.kind === "tree") {
      const { kind: _kind, ...definition } = body;
      return refreshable(
        registries.registerTreeRenderer({ ...definition, id: view.id, title: view.title, icon: view.icon }, metadata),
        () => registries.refresh(view.id),
      );
    }
    if (body.kind === "file") {
      const { kind: _kind, ...definition } = body;
      return refreshable(
        registries.registerFileRenderer({ ...definition, id: view.id, title: view.title }, metadata),
        (input) =>
          registries.refreshFileRenderer(view.id, input as Parameters<FileRendererRegistry["refreshFileRenderer"]>[1]),
      );
    }
    if (body.kind === "controls") {
      const { kind: _kind, ...definition } = body;
      return refreshable(
        registries.registerControlsRenderer({ ...definition, id: view.id, title: view.title }, metadata),
        () => registries.refreshControlsRenderer(view.id),
      );
    }
    if (body.kind === "kanban") {
      const { kind: _kind, ...definition } = body;
      return refreshable(
        registries.registerKanbanRenderer({ ...definition, id: view.id, title: view.title }, metadata),
        () => registries.refreshKanbanRenderer(view.id),
      );
    }

    const { kind: _kind, ...definition } = body;
    return refreshable(
      registries.registerDataTableRenderer({ ...definition, id: view.id, title: view.title }, metadata),
      () => registries.refreshDataTableRenderer(view.id),
    );
  };
