import type { ResourceRef } from "../../core";

export const rendererExampleKind = "renderer-example";
export const reactRendererId = "renderer-types.react";
export const bridgeRendererId = "renderer-types.bridge";
export const reactWidgetId = "renderer-types.react-widget";
export const bridgeWidgetId = "renderer-types.bridge-widget";
export const openReactCommandId = "renderer-types.openReact";
export const openBridgeCommandId = "renderer-types.openBridge";
export const bridgeActionMessageType = "pstdio-workbench.renderer-types.bridge-action";

export const reactResource = {
  kind: rendererExampleKind,
  uri: "pstdio://renderer-types/react",
  id: "react",
  label: "React renderer",
  icon: "Component",
} satisfies ResourceRef;

export const bridgeResource = {
  kind: rendererExampleKind,
  uri: "pstdio://renderer-types/bridge",
  id: "bridge",
  label: "Bridge renderer",
  icon: "Cable",
} satisfies ResourceRef;

export const rendererRows = [
  {
    id: reactRendererId,
    kind: "React",
    transport: "WorkbenchWidgetRenderInput -> ReactNode",
  },
  {
    id: bridgeRendererId,
    kind: "Bridge",
    transport: "WorkbenchWidgetRenderInput -> iframe bridge",
  },
];
