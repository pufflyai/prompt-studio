import type { ResourceRef, WorkbenchModuleContribution } from "../../core";
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
import { BridgeRendererWidget, ReactRendererWidget } from "./widgets";

const resolveWidgetId = (resource: ResourceRef) => (resource.id === bridgeResource.id ? bridgeWidgetId : reactWidgetId);

export const createRendererTypesExampleModule = (): WorkbenchModuleContribution => ({
  id: "renderer-types",
  activate(ctx) {
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
    });

    ctx.renderers.registerRenderer({
      id: reactRendererId,
      render: (input) => <ReactRendererWidget input={input} />,
    });
    ctx.renderers.registerRenderer({
      id: bridgeRendererId,
      render: (input) => <BridgeRendererWidget input={input} />,
    });

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
  },
});
