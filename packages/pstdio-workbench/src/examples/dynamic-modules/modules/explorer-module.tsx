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
      area: "main-left",
      singleton: true,
      rendererId: explorerWidgetId,
      areaSize: { defaultPx: 300, minPx: 220, maxPx: 460 },
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
    ctx.trees.registerTreeView({
      id: explorerTreeId,
      title: "Explorer",
      area: "left",
      icon: "FolderTree",
      defaultExpandedSectionIds: ["workspace"],
      getRoots: () => [],
      getSections: () => [
        {
          id: "workspace",
          nodes: [{ id: readmeResource.uri, label: "README.md", icon: "FileText", resource: readmeResource }],
        },
      ],
      getChildren: () => [],
    });
    ctx.commands.registerCommand(
      { id: explorerCommandId, label: "Open README", category: "Dynamic modules", icon: "FileText" },
      { execute: () => ctx.resources.openResource(readmeResource) },
    );
    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: explorerCommandId, order: 20 });
    void ctx.resources.openResource(readmeResource);
  },
});
