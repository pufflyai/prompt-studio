import { Stack, Text } from "@chakra-ui/react";
import { Breadcrumb, type BreadcrumbItem, PanelLayout } from "@pstdio/ui";
import { Link, useParams } from "@tanstack/react-router";
import { ExtensionWebviewFrame } from "@/shared/extensions/components/extension-webview-frame";
import { useProjectExtensionMetadata } from "@/shared/extensions/hooks/use-project-extensions";
import { PROJECT_SIDEBAR_STORAGE_KEY } from "@/shared/sidebar/project-sidebar";
import { DashboardHeader } from "../components/dashboard-header";
import { ProjectSidebar } from "../components/project-sidebar";

export const ProjectExtensionRoute = () => {
  const { projectId, extensionRoutePath } = useParams({ strict: false });
  const { data, isLoading } = useProjectExtensionMetadata(projectId);
  const route = data?.routes.find((item) => item.path === extensionRoutePath) ?? null;
  const breadcrumbItems: BreadcrumbItem[] = [{ title: route?.label ?? "Extension" }];

  return (
    <PanelLayout sidebar={<ProjectSidebar />}>
      <Stack flex="1" minH="0" gap="0">
        <DashboardHeader
          title={<Breadcrumb separator="/" separatorGap="xs" items={breadcrumbItems} linkComponent={Link} />}
          sidebarStorageKey={PROJECT_SIDEBAR_STORAGE_KEY}
        />
        {isLoading ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted" p="md">
            Loading extension view...
          </Text>
        ) : route ? (
          <ExtensionWebviewFrame
            title={route.label}
            webview={route.webview}
            webviewId={route.id}
            extensionId={route.extensionId}
            extensionInstanceId={route.extensionInstanceId}
            installName={route.installName}
          />
        ) : (
          <Text textStyle="paragraph/S/regular" color="fg.muted" p="md">
            Extension view not found.
          </Text>
        )}
      </Stack>
    </PanelLayout>
  );
};
