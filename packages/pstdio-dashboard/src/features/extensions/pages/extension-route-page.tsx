import { Box, Stack, Text } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import { Breadcrumb, EmptyState, PanelLayout } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { buildExtensionRouteAssetUrl, getExtensionRouteByPath } from "@/features/extensions/extension-routes";
import { useExtensionsCheck } from "@/features/extensions/hooks/use-extensions-check";
import { DashboardHeader } from "@/features/project/components/dashboard-header";
import { PROJECT_SIDEBAR_STORAGE_KEY, ProjectSidebar } from "@/features/project/components/project-sidebar";

const frameStyle = {
  border: 0,
  display: "block",
  height: "100%",
  width: "100%",
} satisfies CSSProperties;

export const ExtensionRoutePage = () => {
  const { extensionRoute } = useParams({ strict: false });
  const extensionsCheck = useExtensionsCheck();
  const route = getExtensionRouteByPath(extensionsCheck.data?.routes, extensionRoute);
  const title = route?.label ?? extensionRoute ?? "Extension";
  const breadcrumbItems: BreadcrumbItem[] = [{ title }];

  return (
    <PanelLayout sidebar={<ProjectSidebar />}>
      <Stack gap="0" height="100%" flex="1" minW="0">
        <DashboardHeader
          title={<Breadcrumb separator="/" separatorGap="xs" items={breadcrumbItems} />}
          sidebarStorageKey={PROJECT_SIDEBAR_STORAGE_KEY}
        />

        <Box flex="1" minH="0" minW="0" overflow="hidden">
          {extensionsCheck.isLoading ? (
            <Text textStyle="paragraph/S/regular" color="fg.muted" p="md">
              Loading extension...
            </Text>
          ) : route ? (
            <iframe
              title={route.label}
              src={buildExtensionRouteAssetUrl(route)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              style={frameStyle}
            />
          ) : (
            <EmptyState title="Extension route not found" description="No installed extension provides this route." />
          )}
        </Box>
      </Stack>
    </PanelLayout>
  );
};
