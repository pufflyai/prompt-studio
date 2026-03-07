import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { Outlet, useParams } from "@tanstack/react-router";
import { ProjectSidebar } from "../components/project-sidebar";
import { useProject } from "../hooks/use-project";

export const ProjectShell = () => {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading } = useProject(projectId);

  return (
    <Flex height="100%" width="100%" minH="0">
      {projectId ? <ProjectSidebar /> : null}
      <Stack flex="1" minH="0" gap="0" overflow="hidden">
        <Box flex="1" overflowY="auto">
          {isLoading ? (
            <Text textStyle="paragraph/S/regular" color="fg.muted" p="md">
              Loading project...
            </Text>
          ) : !project ? (
            <EmptyState title="Project not found" description="Choose a project from the list to continue." />
          ) : (
            <Outlet />
          )}
        </Box>
      </Stack>
    </Flex>
  );
};
