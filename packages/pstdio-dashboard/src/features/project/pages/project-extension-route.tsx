import { Stack, Text } from "@chakra-ui/react";
import { PanelLayout } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { ExtensionWebviewFrame } from "@/shared/extensions/components/extension-webview-frame";
import { useProjectExtensionMetadata } from "@/shared/extensions/hooks/use-project-extensions";
import { ProjectSidebar } from "../components/project-sidebar";

export const ProjectExtensionRoute = () => {
  const { projectId, extensionRoutePath } = useParams({ strict: false });
  const { data, isLoading } = useProjectExtensionMetadata(projectId);
  const route = data?.routes.find((item) => item.path === extensionRoutePath) ?? null;

  return (
    <PanelLayout sidebar={<ProjectSidebar />}>
      <Stack flex="1" minH="0">
        {isLoading ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted" p="md">
            Loading extension view...
          </Text>
        ) : route ? (
          <ExtensionWebviewFrame title={route.label} webview={route.webview} />
        ) : (
          <Text textStyle="paragraph/S/regular" color="fg.muted" p="md">
            Extension view not found.
          </Text>
        )}
      </Stack>
    </PanelLayout>
  );
};
