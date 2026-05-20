import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { WorkbenchIcon, type WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { EmptyState, SurfaceListRow } from "@/services/components/surface";
import { dashboardSettingsSections, settingsSectionResource } from "@/services/workbench/resources/resource-kinds";
import { useAgentConfigs, useProjectRepos, useSettingsProject } from "../hooks/use-settings-data";

const SectionRail = (props: { activeId: string; onSelect: (id: string) => void }) => {
  const { activeId, onSelect } = props;

  return (
    <Stack gap="2xs" w="220px" flexShrink={0} borderRightWidth="1px" borderColor="border.muted" p="sm" overflowY="auto">
      {dashboardSettingsSections.map((section) => (
        <HStack
          as="button"
          key={section.id}
          gap="sm"
          px="sm"
          py="xs"
          borderRadius="md"
          textAlign="left"
          bg={section.id === activeId ? "bg.emphasized" : undefined}
          _hover={{ bg: "bg.muted" }}
          onClick={() => onSelect(section.id)}
        >
          <WorkbenchIcon name={section.icon} size={16} />
          <Text textStyle="label/M/medium">{section.label}</Text>
        </HStack>
      ))}
    </Stack>
  );
};

const GeneralSection = (props: { projectId: string }) => {
  const project = useSettingsProject(props.projectId);
  const repos = useProjectRepos(props.projectId);

  return (
    <Stack gap="md" maxW="640px">
      <Text textStyle="paragraph/M/regular" color="fg.muted">
        Project configuration synced from the pstdio API.
      </Text>
      <SurfaceListRow icon="FolderGit2" title={project?.name ?? "Project"} description={`ID: ${props.projectId}`} />
      <SurfaceListRow icon="GitBranch" title="Repositories" description={`${repos.length} linked`} />
    </Stack>
  );
};

const RepositoriesSection = (props: { projectId: string }) => {
  const repos = useProjectRepos(props.projectId);
  if (repos.length === 0) return <EmptyState title="No repositories linked" />;
  return (
    <Stack gap="xs" maxW="640px">
      {repos.map((repo) => (
        <SurfaceListRow key={repo.id} icon="FolderGit2" title={repo.name} description={repo.path} />
      ))}
    </Stack>
  );
};

const AgentsSection = () => {
  const agents = useAgentConfigs();
  if (agents.length === 0) return <EmptyState title="No agents configured" />;
  return (
    <Stack gap="xs" maxW="640px">
      {agents.map((agent) => (
        <SurfaceListRow
          key={agent.id}
          icon="Bot"
          title={agent.agentId}
          trailing={agent.isDefault ? <Badge colorPalette="green">Default</Badge> : undefined}
        />
      ))}
    </Stack>
  );
};

const SectionContent = (props: { sectionId: string; projectId: string }) => {
  const { sectionId, projectId } = props;
  if (sectionId === "repositories") return <RepositoriesSection projectId={projectId} />;
  if (sectionId === "agents") return <AgentsSection />;
  return <GeneralSection projectId={projectId} />;
};

export const SettingsPanel = (props: { input: WorkbenchWidgetRenderInput; projectId: string }) => {
  const { input, projectId } = props;
  const requested = input.placement.resource?.id ?? "general";
  const sectionId = dashboardSettingsSections.some((section) => section.id === requested) ? requested : "general";
  const section = dashboardSettingsSections.find((entry) => entry.id === sectionId);

  return (
    <HStack h="full" minH="0" gap="0" align="stretch">
      <SectionRail
        activeId={sectionId}
        onSelect={(id) => void input.workbench.resources.openResource(settingsSectionResource(id))}
      />
      <Stack flex="1" minW="0" gap="0">
        <Box px="lg" py="md" borderBottomWidth="1px" borderColor="border.muted">
          <Text textStyle="label/L/semibold">{section?.label ?? "Settings"}</Text>
        </Box>
        <Box flex="1" minH="0" overflowY="auto" p="lg">
          <SectionContent sectionId={sectionId} projectId={projectId} />
        </Box>
      </Stack>
    </HStack>
  );
};
