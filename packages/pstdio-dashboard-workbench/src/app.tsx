import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { Workbench } from "pstdio-workbench/react";
import { useEffect, useState } from "react";
import { useBackendConnectionStatus } from "@/lib/sync/sync-provider";
import { useProjects } from "@/modules/project/hooks/use-project";
import { createDashboardWorkbench } from "@/services/workbench/create-dashboard-workbench";

interface DashboardProjectRef {
  id: string;
}

const readProjectIdFromLocation = () => {
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments[0] === "projects" && segments[1]) return segments[1];
  return undefined;
};

const BootScreen = (props: { message: string; spinner?: boolean }) => (
  <Stack h="100dvh" align="center" justify="center" gap="md">
    {props.spinner ? <Spinner size="lg" /> : null}
    <Text textStyle="paragraph/M/regular" color="fg.muted">
      {props.message}
    </Text>
  </Stack>
);

type DashboardProjectState =
  | { status: "ready"; projectId: string }
  | { status: "loading" }
  | { status: "empty" }
  | { status: "not-found" };

export const resolveDashboardProjectState = (
  projects: DashboardProjectRef[],
  fromUrl: string | undefined,
  projectsLoaded: boolean,
): DashboardProjectState => {
  if (fromUrl) {
    if (projects.some((project) => project.id === fromUrl)) return { status: "ready", projectId: fromUrl };
    return projectsLoaded ? { status: "not-found" } : { status: "loading" };
  }

  const firstProject = projects[0];
  if (firstProject) return { status: "ready", projectId: firstProject.id };
  return projectsLoaded ? { status: "empty" } : { status: "loading" };
};

// Owns one `WorkbenchCore` for the active project and renders the React shell.
// Keyed by project id so switching projects rebuilds the workbench cleanly.
const WorkbenchHost = (props: { projectId: string }) => {
  const { projectId } = props;
  const [workbench] = useState(() => createDashboardWorkbench(projectId));

  useEffect(() => {
    // Deep links enter through workbench navigation parsing rather than a router.
    const location = `${window.location.pathname}${window.location.search}`;
    void workbench.navigation.navigate(location).catch(() => undefined);
  }, [workbench]);

  return (
    <Box h="100dvh" w="100vw" overflow="hidden">
      <Workbench workbench={workbench} />
    </Box>
  );
};

// Resolves the active project from the URL or the first synced project, then
// hands control to the workbench shell.
export const DashboardApp = () => {
  const projects = useProjects();
  const connectionStatus = useBackendConnectionStatus();
  const fromUrl = readProjectIdFromLocation();
  const projectState = resolveDashboardProjectState(projects, fromUrl, connectionStatus !== "connecting");

  if (projectState.status === "ready") {
    return <WorkbenchHost key={projectState.projectId} projectId={projectState.projectId} />;
  }
  if (projectState.status === "not-found") return <BootScreen message="Project not found." />;
  if (projectState.status === "loading") return <BootScreen message="Connecting to the pstdio API…" spinner />;
  return <BootScreen message="No projects available." />;
};
