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
    ctx.layout.registerWidget({
      id: explorerWidgetId,
      title: "File preview",
      region: "main-left-menu",
      singleton: true,
      rendererId: explorerWidgetId,
      regionSize: { defaultPx: 300, minPx: 220, maxPx: 460 },
    });
    ctx.resources.registerOpener({
      id: `${explorerModuleId}.opener`,
      priority: 100,
      canOpen: (resource) => resource.kind === fileKind,
      open: (resource, input) =>
        ctx.layout.openWidget(explorerWidgetId, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
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
    ctx.layout.registerWidget({
      id: explorerTreeId,
      title: "Explorer",
      region: "sidenav",
      rendererId: explorerTreeId,
    });
    ctx.layout.openWidget(explorerTreeId);
    ctx.commands.registerCommand(
      { id: explorerCommandId, label: "Open README", category: "Dynamic modules", icon: "FileText" },
      { execute: () => ctx.resources.openResource(readmeResource) },
    );
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: explorerCommandId, order: 20 });
    void ctx.resources.openResource(readmeResource);
  },
});
