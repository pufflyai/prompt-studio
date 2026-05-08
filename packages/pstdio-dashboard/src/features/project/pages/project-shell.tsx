import { Flex, Text } from "@chakra-ui/react";
import { EmptyState, ResizableSplitLayout, ThemePreferenceProvider, useThemePreference } from "@pstdio/ui";
import { Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { SessionAttachedPanel } from "@/features/sessions/components/session-attached-panel";
import { SessionBubbleContainer } from "@/features/sessions/components/session-bubble.container";
import { isSessionsRoutePath } from "@/features/sessions/utils/sessions-route";
import { ShortcutProvider } from "@/features/shortcuts/shortcut-provider";
import { ProjectSettingsProvider, useProjectSettingsStore } from "@/shared/stores/project-settings";
import { mergeDashboardThemePreferences } from "../../../theme-preferences";
import { useExtensionAppearanceThemePreferences } from "../../extensions/use-extension-appearance";
import { useProject } from "../hooks/use-project";

const ProjectShellContent = () => {
  const { projectId } = useParams({ strict: false });
  const { location } = useRouterState();
  const { data: project, isLoading } = useProject(projectId);
  const { t } = useTranslation("projects");
  const sessionModalState = useProjectSettingsStore((s) => s.sessionModalState);
  const setSessionModalState = useProjectSettingsStore((s) => s.setSessionModalState);
  const setLastNonSessionsPath = useProjectSettingsStore((s) => s.setLastNonSessionsPath);
  const isSessionsRoute = isSessionsRoutePath(location.pathname, projectId);

  useLayoutEffect(() => {
    if (!projectId || isSessionsRoute) return;
    const currentPath =
      typeof window === "undefined"
        ? location.pathname
        : `${window.location.pathname}${window.location.search}${window.location.hash}`;
    setLastNonSessionsPath(currentPath);
  }, [isSessionsRoute, location.pathname, projectId, setLastNonSessionsPath]);

  const content = (
    <Flex flex="1" minW={0} minH={0} overflow="hidden">
      {isLoading ? (
        <Text textStyle="paragraph/S/regular" color="fg.muted" p="md">
          {t("shell.loadingProject")}
        </Text>
      ) : !project ? (
        <EmptyState title={t("shell.notFound")} description={t("shell.notFoundDescription")} />
      ) : (
        <Outlet />
      )}
    </Flex>
  );
  const showAttachedPanel = sessionModalState === "attached" && !isSessionsRoute;

  return (
    <Flex height="100%" width="100%" minH="0">
      {showAttachedPanel ? (
        <ResizableSplitLayout
          flex="1"
          minH="0"
          minW="0"
          resizableSide="right"
          contentPanel={content}
          resizablePanel={<SessionAttachedPanel />}
          defaultSizePx={448}
          minSizePx={320}
          contentMinSizePx={320}
          resizeLabel="Resize attached panel"
          showResizeSeparator={false}
          onCollapsedChange={(collapsed) => {
            if (collapsed) setSessionModalState("bubble");
          }}
        />
      ) : (
        content
      )}
      {!isSessionsRoute ? <SessionBubbleContainer /> : null}
    </Flex>
  );
};

export const ProjectShell = () => {
  const { projectId } = useParams({ strict: false });
  const { themePreference } = useThemePreference();
  const extensionThemePreferences = useExtensionAppearanceThemePreferences(projectId);
  const themePreferences = mergeDashboardThemePreferences(extensionThemePreferences);

  return (
    <ThemePreferenceProvider initialPreference={themePreference} themePreferences={themePreferences}>
      <ProjectSettingsProvider projectId={projectId}>
        <ShortcutProvider>
          <ProjectShellContent />
        </ShortcutProvider>
      </ProjectSettingsProvider>
    </ThemePreferenceProvider>
  );
};
