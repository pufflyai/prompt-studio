import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { ProjectSettingsProvider, useProjectSettingsStore } from "@/features/project-settings/store";
import { SessionAttachedPanel } from "@/features/sessions/components/session-attached-panel";
import { SessionBubbleContainer } from "@/features/sessions/components/session-bubble.container";
import { isSessionsRoutePath } from "@/features/sessions/utils/sessions-route";
import { isWorkspaceRoutePath } from "@/features/workspaces/utils/workspace-route";
import { ProjectSidebar } from "../components/project-sidebar";
import { useProject } from "../hooks/use-project";

const isSettingsRoutePath = (pathname: string, projectId: string | undefined) => {
  if (!projectId) return false;
  const settingsPath = `/projects/${projectId}/settings`;
  return pathname === settingsPath || pathname.startsWith(`${settingsPath}/`);
};

const ProjectShellContent = () => {
  const { projectId } = useParams({ strict: false });
  const { location } = useRouterState();
  const { data: project, isLoading } = useProject(projectId);
  const { t } = useTranslation("projects");
  const sessionModalState = useProjectSettingsStore((s) => s.sessionModalState);
  const setLastNonSessionsPath = useProjectSettingsStore((s) => s.setLastNonSessionsPath);
  const isSessionsRoute = isSessionsRoutePath(location.pathname, projectId);
  const isWorkspaceRoute = isWorkspaceRoutePath(location.pathname, projectId);
  const isSettingsRoute = isSettingsRoutePath(location.pathname, projectId);
  const showMainSidebar = projectId && !isSessionsRoute && !isSettingsRoute && !isWorkspaceRoute;

  useLayoutEffect(() => {
    if (!projectId || isSessionsRoute) return;
    const currentPath =
      typeof window === "undefined"
        ? location.pathname
        : `${window.location.pathname}${window.location.search}${window.location.hash}`;
    setLastNonSessionsPath(currentPath);
  }, [isSessionsRoute, location.pathname, projectId, setLastNonSessionsPath]);

  return (
    <Flex height="100%" width="100%" minH="0">
      {showMainSidebar ? <ProjectSidebar /> : null}
      <Stack flex="1" minH="0" gap="0" overflow="hidden">
        <Box flex="1" overflowY="auto">
          {isLoading ? (
            <Text textStyle="paragraph/S/regular" color="fg.muted" p="md">
              {t("shell.loadingProject")}
            </Text>
          ) : !project ? (
            <EmptyState title={t("shell.notFound")} description={t("shell.notFoundDescription")} />
          ) : (
            <Outlet />
          )}
        </Box>
      </Stack>
      {sessionModalState === "attached" && !isSessionsRoute && !isWorkspaceRoute ? <SessionAttachedPanel /> : null}
      {!isSessionsRoute && !isWorkspaceRoute ? <SessionBubbleContainer /> : null}
    </Flex>
  );
};

export const ProjectShell = () => {
  const { projectId } = useParams({ strict: false });

  return (
    <ProjectSettingsProvider projectId={projectId}>
      <ProjectShellContent />
    </ProjectSettingsProvider>
  );
};
