import { type WorkbenchModuleContribution, workbenchCommandPaletteMenuPath } from "../../../core";
import { FilePreviewWidget } from "../components/file-preview-widget";
import {
  explorerCommandId,
  explorerModuleId,
  explorerTreeId,
  explorerWidgetId,
  fileKind,
  readmeResource,
} from "../data";

export const createExplorerModule = (): WorkbenchModuleContribution => ({
  id: explorerModuleId,
  ownerId: explorerModuleId,
  source: "extension",
  activate(ctx) {
    ctx.resources.registerKind({ kind: fileKind, label: "File", icon: "FileText" });
    ctx.renderers.registerRenderer({ id: explorerWidgetId, render: () => <FilePreviewWidget /> });
    ctx.layout.registerPanel({
      closable: false,
      id: explorerWidgetId,
      title: "File preview",
      region: "main-left-menu",
      singleton: true,
      rendererId: explorerWidgetId,
      regionSize: { defaultPx: 300, minPx: 220, maxPx: 460 },
    });
    ctx.resources.registerPresenter({
      id: `${explorerModuleId}.presenter`,
      priority: 100,
      canOpen: (resource) => resource.kind === fileKind,
      open: (resource, input) =>
        ctx.layout.openPanel(explorerWidgetId, {
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
          resource,
          title: resource.label,
        }),
    });
    ctx.renderers.registerTreeRenderer({
      id: explorerTreeId,
      title: "Explorer",
      icon: "FolderTree",
      defaultExpandedSectionIds: ["workspace"],
      getBody: () => [
        {
          id: "workspace",
          nodes: [{ id: readmeResource.uri, label: "README.md", icon: "FileText", resource: readmeResource }],
        },
      ],
      getChildren: () => [],
    });
    ctx.layout.registerPanel({
      closable: false,
      id: explorerTreeId,
      title: "Explorer",
      region: "sidenav",
      rendererId: explorerTreeId,
    });
    ctx.layout.openPanel(explorerTreeId);
    ctx.commands.registerCommand(
      { id: explorerCommandId, label: "Open README", category: "Dynamic modules", icon: "FileText" },
      { execute: () => ctx.resources.openResource(readmeResource) },
    );
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: explorerCommandId, order: 20 });
    void ctx.resources.openResource(readmeResource);
  },
});
