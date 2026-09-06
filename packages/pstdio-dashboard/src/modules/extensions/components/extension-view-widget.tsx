import { Box, Center, Text } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { ExtensionWebviewFrame } from "@/shared/extensions/components/extension-webview-frame";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

const readProjectId = (value: unknown) => {
  const projectId = (value as { projectId?: unknown } | undefined)?.projectId;
  return typeof projectId === "string" ? projectId : undefined;
};

// The placement carries the View identity. The panel id identifies only the host
// chrome created for that placement and must not be used to recover its content.
export const resolveExtensionView = (input: Pick<WorkbenchPanelRenderInput, "instance" | "panel" | "workbench">) => {
  const projectId =
    readProjectId(input.instance.resource?.metadata) ??
    readProjectId(input.panel.config) ??
    getDashboardSelectedProjectId(input.workbench);
  if (!projectId) return undefined;
  const metadata = getCachedDashboardExtensionMetadata(projectId);
  const view = metadata?.views.find((candidate) => candidate.id === input.instance.viewId);
  if (view?.body.kind !== "webview") return undefined;
  const extension = metadata?.extensions.find((candidate) => candidate.id === view.extensionId);
  return {
    extensionInstanceId: extension?.extensionInstanceId,
    installName: extension?.installName,
    projectId,
    view,
    webview: view.body.webview,
  };
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

  const { extensionInstanceId, installName, projectId, view, webview } = derived;

  return (
    <Box position="relative" w="full" h="full" minH="0">
      <Box position="absolute" inset="0">
        <ExtensionWebviewFrame
          extensionId={view.extensionId}
          extensionInstanceId={extensionInstanceId}
          installName={installName}
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
      </Box>
    </Box>
  );
};
