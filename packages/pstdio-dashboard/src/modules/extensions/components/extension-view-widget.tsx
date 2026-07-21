import { Box, Center, Text } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "@pstdio/workbench/react";
import { ExtensionWebviewFrame } from "@/shared/extensions/components/extension-webview-frame";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { extensionViewWidgetId } from "../extension-view-placement";

const readProjectId = (value: unknown) => {
  const projectId = (value as { projectId?: unknown } | undefined)?.projectId;
  return typeof projectId === "string" ? projectId : undefined;
};

// The view to mount is derived from the placement's widget id + the cached manifest, not stored
// on the resource (PS-11). First open and Back/Forward replay resolve the same view from the same
// widget id and manifest, so the derived view is stable across navigation.
export const resolveExtensionView = (input: Pick<WorkbenchWidgetRenderInput, "placement" | "widget">) => {
  const projectId = readProjectId(input.placement.resource?.metadata) ?? readProjectId(input.widget.config);
  if (!projectId) return undefined;
  const metadata = getCachedDashboardExtensionMetadata(projectId);
  const view = metadata?.views.find(
    (candidate) => extensionViewWidgetId(candidate.id) === input.placement.contributionId,
  );
  return view ? { projectId, view } : undefined;
};

const modalWebviewHeight = "clamp(320px, calc(100dvh - 8rem), 360px)";

export const ExtensionViewWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const placementResource = input.placement.resource;
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

  const { projectId, view } = derived;

  const frame = (
    <ExtensionWebviewFrame
      extensionId={view.extensionId}
      projectId={projectId}
      resource={placementResource?.id ? { id: placementResource.id, label: placementResource.label } : undefined}
      terminal={input.workbench.terminal}
      title={resolveLocalizableString(view.title, view.extensionId)}
      webview={view.webview}
      webviewId={view.id}
    />
  );

  if (view.role !== "modal") return frame;

  return (
    <Box h={modalWebviewHeight} minH="0" overflow="hidden" w="full">
      {frame}
    </Box>
  );
};
