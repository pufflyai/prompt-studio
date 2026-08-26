import { Center, Text } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { ExtensionWebviewFrame } from "@/shared/extensions/components/extension-webview-frame";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

const readProjectId = (value: unknown) => {
  const projectId = (value as { projectId?: unknown } | undefined)?.projectId;
  return typeof projectId === "string" ? projectId : undefined;
};

// The view to mount is derived from the placement's widget id + the cached manifest, not stored
// on the resource (PS-11). First open and Back/Forward replay resolve the same view from the same
// widget id and manifest, so the derived view is stable across navigation.
export const resolveExtensionView = (input: Pick<WorkbenchPanelRenderInput, "instance" | "panel" | "workbench">) => {
  const projectId =
    readProjectId(input.instance.resource?.metadata) ??
    readProjectId(input.panel.config) ??
    getDashboardSelectedProjectId(input.workbench);
  if (!projectId) return undefined;
  const metadata = getCachedDashboardExtensionMetadata(projectId);
  const view = metadata?.views.find((candidate) => candidate.id === input.instance.panelId);
  return view?.body.kind === "webview" ? { projectId, view, webview: view.body.webview } : undefined;
};

export const ExtensionViewWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const placementResource = input.instance.resource;
  const derived = resolveExtensionView(input);

  if (!derived) {
    return (
      <Center h="full" minH="0" p="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Extension view is unavailable.
        </Text>
      </Center>
    );
  }

  const { projectId, view, webview } = derived;

  return (
    <ExtensionWebviewFrame
      extensionId={view.extensionId}
      projectId={projectId}
      resource={
        placementResource?.id
          ? {
              id: placementResource.id,
              label: placementResource.label,
              metadata: placementResource.metadata,
            }
          : undefined
      }
      terminal={input.workbench.terminal}
      title={resolveLocalizableString(view.title, view.extensionId)}
      webview={webview}
      webviewId={view.id}
      workbench={input.workbench}
    />
  );
};
