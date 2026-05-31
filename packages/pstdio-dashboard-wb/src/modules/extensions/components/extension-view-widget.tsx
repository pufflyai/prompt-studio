import { Center, Text } from "@chakra-ui/react";
import type { WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { ExtensionWebviewFrame } from "@/shared/extensions/components/extension-webview-frame";

type DashboardExtensionView = DashboardExtensionMetadata["views"][number];

const readView = (metadata: Record<string, unknown> | undefined) =>
  metadata?.view as DashboardExtensionView | undefined;

const readProjectId = (metadata: Record<string, unknown> | undefined) => {
  const value = metadata?.projectId;
  return typeof value === "string" ? value : undefined;
};

export const ExtensionViewWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const view = readView(input.placement.resource?.metadata);

  if (!view) {
    return (
      <Center h="full" minH="0" p="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Extension view is unavailable.
        </Text>
      </Center>
    );
  }

  return (
    <ExtensionWebviewFrame
      extensionId={view.extensionId}
      projectId={readProjectId(input.placement.resource?.metadata)}
      title={view.title}
      webview={view.webview}
      webviewId={view.id}
    />
  );
};
