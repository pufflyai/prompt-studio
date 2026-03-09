import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { Outlet, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ProjectSidebar } from "../components/project-sidebar";
import { useProject } from "../hooks/use-project";

export const ProjectShell = () => {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading } = useProject(projectId);
  const { t } = useTranslation("projects");

  return (
    <Flex height="100%" width="100%" minH="0">
      {projectId ? <ProjectSidebar /> : null}
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
    </Flex>
  );
};
