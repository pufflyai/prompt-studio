import { Center, Text } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { ExtensionWebviewFrame } from "@/shared/extensions/components/extension-webview-frame";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import type { DashboardExtensionRoute } from "@/shared/extensions/workbench-extension-contributions";

const readRoute = (metadata: Record<string, unknown> | undefined) =>
  metadata?.route as DashboardExtensionRoute | undefined;

const readProjectId = (metadata: Record<string, unknown> | undefined) => {
  const value = metadata?.projectId;
  return typeof value === "string" ? value : undefined;
};

export const ExtensionRouteWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const route = readRoute(input.instance.resource?.metadata);

  if (!route) {
    return (
      <Center h="full" minH="0" p="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Extension route is unavailable.
        </Text>
      </Center>
    );
  }

  return (
    <ExtensionWebviewFrame
      extensionId={route.extensionId}
      projectId={readProjectId(input.instance.resource?.metadata)}
      terminal={input.workbench.terminal}
      title={resolveLocalizableString(route.label, route.extensionId)}
      webview={route.webview}
      webviewId={route.id}
      workbench={input.workbench}
    />
  );
};
