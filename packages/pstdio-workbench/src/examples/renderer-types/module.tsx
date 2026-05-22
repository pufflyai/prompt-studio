import { createBridgeWebviewRenderer } from "pstdio-extensions/workbench";
import type { ResourceRef, WorkbenchModuleContribution } from "../../core";
import type { BridgeDocumentAssets } from "./bridge-document";
import { bridgeWebviewCapabilities } from "./bridge-document";
import {
  bridgeRendererId,
  bridgeResource,
  bridgeWidgetId,
  openBridgeCommandId,
  openReactCommandId,
  reactRendererId,
  reactResource,
  reactWidgetId,
  rendererExampleKind,
} from "./data";
import { ReactRendererWidget } from "./widgets";

export interface CreateRendererTypesExampleModuleInput {
  createBridgeDocument: () => BridgeDocumentAssets;
}

const resolveWidgetId = (resource: ResourceRef) => (resource.id === bridgeResource.id ? bridgeWidgetId : reactWidgetId);

export const createRendererTypesExampleModule = (
  input: CreateRendererTypesExampleModuleInput,
): WorkbenchModuleContribution => ({
  id: "renderer-types",
  activate(ctx) {
    const bridgeDocument = input.createBridgeDocument();

    ctx.resources.registerKind({ kind: rendererExampleKind, label: "Renderer example", icon: "Component" });
    ctx.resources.registerOpener({
      id: "renderer-types.opener",
      priority: 100,
      canOpen: (resource) => resource.kind === rendererExampleKind,
      open: (resource, input) =>
        ctx.layout.openWidget(resolveWidgetId(resource), {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        }),
    });

    ctx.layout.registerWidget({
      id: reactWidgetId,
      title: "React renderer",
      area: "main",
      rendererId: reactRendererId,
      singleton: true,
    });
    ctx.layout.registerWidget({
      id: bridgeWidgetId,
      title: "Bridge renderer",
      area: "main",
      rendererId: bridgeRendererId,
      singleton: true,
      config: {
        capabilities: [...bridgeWebviewCapabilities],
        moduleUrl: bridgeDocument.moduleUrl,
        runtimeUrl: bridgeDocument.runtimeUrl,
      },
    });

    ctx.renderers.registerRenderer({
      id: reactRendererId,
      render: (input) => <ReactRendererWidget input={input} />,
    });
    ctx.renderers.registerRenderer(
      createBridgeWebviewRenderer({
        createProps: ({ placement }) => ({
          placementId: placement.contributionId,
          rendererId: bridgeRendererId,
          resource: placement.resource?.uri,
          title: placement.title ?? "Bridge renderer",
          widgetId: bridgeWidgetId,
        }),
      }),
    );

    ctx.commands.registerCommand(
      { id: openReactCommandId, label: "Open React renderer", category: "Renderer types", icon: "Component" },
      { execute: () => ctx.layout.openWidget(reactWidgetId, { resource: reactResource }) },
    );
    ctx.commands.registerCommand(
      { id: openBridgeCommandId, label: "Open bridge renderer", category: "Renderer types", icon: "Cable" },
      { execute: () => ctx.layout.openWidget(bridgeWidgetId, { resource: bridgeResource }) },
    );

    ctx.layout.openWidget(reactWidgetId, { resource: reactResource });
    ctx.layout.openWidget(bridgeWidgetId, { resource: bridgeResource });

    return { dispose: () => bridgeDocument.dispose() };
  },
});
