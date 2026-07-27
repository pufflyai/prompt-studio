import type { ResourceRef, WorkbenchModuleContribution } from "../../core";
import { createBridgeWebviewRenderer } from "../../extensions";
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
    ctx.resources.registerPresenter({
      id: "renderer-types.presenter",
      priority: 100,
      canOpen: (resource) => resource.kind === rendererExampleKind,
      open: (resource, input) =>
        ctx.layout.openPanel(resolveWidgetId(resource), {
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "activate-or-open" },
          resource,
          title: resource.label,
        }),
    });

    ctx.layout.registerPanel({
      closable: false,
      id: reactWidgetId,
      title: "React renderer",
      region: "main",
      rendererId: reactRendererId,
      singleton: true,
    });
    ctx.layout.registerPanel({
      closable: false,
      id: bridgeWidgetId,
      title: "Bridge renderer",
      region: "main",
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
          placementId: placement.panelId,
          rendererId: bridgeRendererId,
          resource: placement.resource?.uri,
          title: placement.title ?? "Bridge renderer",
          panelId: bridgeWidgetId,
        }),
      }),
    );

    ctx.commands.registerCommand(
      { id: openReactCommandId, label: "Open React renderer", category: "Renderer types", icon: "Component" },
      { execute: () => ctx.layout.openPanel(reactWidgetId, { resource: reactResource }) },
    );
    ctx.commands.registerCommand(
      { id: openBridgeCommandId, label: "Open bridge renderer", category: "Renderer types", icon: "Cable" },
      { execute: () => ctx.layout.openPanel(bridgeWidgetId, { resource: bridgeResource }) },
    );

    ctx.layout.openPanel(reactWidgetId, { resource: reactResource });
    ctx.layout.openPanel(bridgeWidgetId, { resource: bridgeResource });

    return { dispose: () => bridgeDocument.dispose() };
  },
});
