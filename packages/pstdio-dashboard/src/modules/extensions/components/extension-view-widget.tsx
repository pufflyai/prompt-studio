import { Box, Center, Text } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { ExtensionWebviewFrame } from "@/shared/extensions/components/extension-webview-frame";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { extensionViewWidgetId } from "../extension-view-placement";

const readProjectId = (metadata: Record<string, unknown> | undefined) => {
  const value = metadata?.projectId;
  return typeof value === "string" ? value : undefined;
};

// The view to mount is derived from the placement's widget id + the cached manifest, not stored
// on the resource (PS-11). First open and Back/Forward replay resolve the same view from the same
// widget id and manifest, so the derived view is stable across navigation.
const deriveView = (placement: WorkbenchWidgetRenderInput["placement"]) => {
  const projectId = readProjectId(placement.resource?.metadata);
  if (!projectId) return undefined;
  const metadata = getCachedDashboardExtensionMetadata(projectId);
  return metadata?.views.find((view) => extensionViewWidgetId(view.id) === placement.contributionId);
};

const modalWebviewHeight = "clamp(320px, calc(100dvh - 8rem), 360px)";

export const ExtensionViewWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const placementResource = input.placement.resource;
  const view = deriveView(input.placement);

  if (!view) {
    return (
      <Center h="full" minH="0" p="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Extension view is unavailable.
        </Text>
      </Center>
    );
  }

  const frame = (
    <ExtensionWebviewFrame
      extensionId={view.extensionId}
      projectId={readProjectId(placementResource?.metadata)}
      resource={placementResource?.id ? { id: placementResource.id, label: placementResource.label } : undefined}
      title={resolveLocalizableString(view.title, view.extensionId)}
      webview={view.webview}
      webviewId={view.id}
    />
  );

  if (view.surface !== "modal") return frame;

  return (
    <Box h={modalWebviewHeight} minH="0" overflow="hidden" w="full">
      {frame}
    </Box>
  );
};
