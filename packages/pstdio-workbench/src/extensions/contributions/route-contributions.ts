import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, ResourceRef, WorkbenchModuleContributionContext } from "../../core";
import { BRIDGE_WEBVIEW_RENDERER_ID } from "../bridge/bridge-webview-renderer";
import { toBridgeWebviewConfig } from "../bridge/webview-contribution-config";

export interface RegisterWorkbenchExtensionRoutesInput {
  metadata: WorkbenchExtensionMetadata;
  routeResourceKind: string;
  workbench: WorkbenchModuleContributionContext;
}

export const routeResource = (
  route: WorkbenchExtensionMetadata["routes"][number],
  routeResourceKind: string,
): ResourceRef => ({
  kind: routeResourceKind,
  uri: `workbench://extension-route/${encodeURIComponent(route.id)}`,
  id: route.id,
  label: text(route.label, route.id),
  metadata: { extensionId: route.extensionId, extensionRouteId: route.id, path: route.path },
});

export const routeFromResource = (metadata: WorkbenchExtensionMetadata, resource: ResourceRef) =>
  metadata.routes.find((route) => resource.id === route.id || resource.metadata?.extensionRouteId === route.id);

export const registerWorkbenchExtensionRoutes = (input: RegisterWorkbenchExtensionRoutesInput) => {
  if (input.metadata.routes.length === 0) return [] as Disposable[];
  const disposables: Disposable[] = [];
  if (!input.workbench.resources.getKind(input.routeResourceKind)) {
    disposables.push(
      input.workbench.resources.registerKind({
        kind: input.routeResourceKind,
        label: "Extension route",
        icon: "Component",
      }),
    );
  }

  for (const route of input.metadata.routes) {
    disposables.push(
      input.workbench.layout.registerWidget({
        id: route.id,
        title: text(route.label, route.id),
        area: "main",
        rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
        singleton: true,
        config: toBridgeWebviewConfig(route.webview),
      }),
    );
  }

  disposables.push(
    input.workbench.resources.registerProvider({
      id: "workbench.extension.routes",
      kind: input.routeResourceKind,
      list: () => input.metadata.routes.map((route) => ({ resource: routeResource(route, input.routeResourceKind) })),
    }),
    input.workbench.resources.registerOpener({
      id: "workbench.extension.routes",
      canOpen: (resource) =>
        resource.kind === input.routeResourceKind && Boolean(routeFromResource(input.metadata, resource)),
      open: (resource, openInput) => {
        const route = routeFromResource(input.metadata, resource);
        if (!route) return undefined;
        return input.workbench.layout.openWidget(route.id, {
          replaceActive: openInput.replaceActive,
          title: text(route.label, route.id),
        });
      },
    }),
  );

  return disposables;
};
