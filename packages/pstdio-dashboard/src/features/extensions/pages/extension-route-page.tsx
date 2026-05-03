import { Box, Stack, Text } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import { Breadcrumb, EmptyState, isThemePreference, PanelLayout, useThemePreference } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { buildExtensionThemeMessage, readExtensionHostMessage } from "@/features/extensions/extension-host-messages";
import { buildExtensionRouteAssetUrl, getExtensionRouteByPath } from "@/features/extensions/extension-routes";
import { useExtensionsCheck } from "@/features/extensions/hooks/use-extensions-check";
import { DashboardHeader } from "@/features/project/components/dashboard-header";
import { PROJECT_SIDEBAR_STORAGE_KEY, ProjectSidebar } from "@/features/project/components/project-sidebar";
import { useOpenCommandPalette } from "@/features/shortcuts/shortcut-provider";

const frameStyle = {
  border: 0,
  display: "block",
  height: "100%",
  width: "100%",
} satisfies CSSProperties;

export const ExtensionRoutePage = () => {
  const { projectId, extensionRoute } = useParams({ strict: false });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialThemePreferenceRef = useRef<string | undefined>(undefined);
  const openCommandPalette = useOpenCommandPalette();
  const { themePreference, themePreferences, setThemePreference } = useThemePreference();
  const extensionsCheck = useExtensionsCheck();
  const route = getExtensionRouteByPath(extensionsCheck.data?.routes, extensionRoute);
  const title = route?.label ?? extensionRoute ?? "Extension";
  const breadcrumbItems: BreadcrumbItem[] = [{ title }];

  if (initialThemePreferenceRef.current === undefined) {
    initialThemePreferenceRef.current = themePreference;
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;

      const message = readExtensionHostMessage(event.data);
      if (!message) return;

      if (message.type === "open-command-palette") {
        openCommandPalette();
        return;
      }

      if (isThemePreference(message.themePreference, themePreferences)) {
        setThemePreference(message.themePreference);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [openCommandPalette, setThemePreference, themePreferences]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(buildExtensionThemeMessage(themePreference), window.location.origin);
  }, [themePreference]);

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
              ref={iframeRef}
              title={route.label}
              src={buildExtensionRouteAssetUrl(route, undefined, {
                projectId,
                themePreference: initialThemePreferenceRef.current,
              })}
              onLoad={() => {
                iframeRef.current?.contentWindow?.postMessage(
                  buildExtensionThemeMessage(themePreference),
                  window.location.origin,
                );
              }}
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
