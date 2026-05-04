import { Box, Spinner } from "@chakra-ui/react";
import { useAgents } from "@/features/agents/hooks/use-agents";
import { useProjectDefaults, useUpdateProjectDefaults } from "../hooks/use-project-defaults";
import { ProjectAgentsPanelView } from "./project-agents-panel-view";

interface ProjectAgentsPanelProps {
  projectId: string | undefined;
}

export const ProjectAgentsPanel = (props: ProjectAgentsPanelProps) => {
  const { projectId } = props;

  const { data: project, isLoading: isProjectLoading } = useProjectDefaults(projectId);
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents();
  const update = useUpdateProjectDefaults(projectId);

  if (isProjectLoading || isAgentsLoading) {
    return (
      <Box py="lg" display="flex" justifyContent="center">
        <Spinner size="sm" />
      </Box>
    );
  }

  return (
    <ProjectAgentsPanelView
      enabledAgentIds={(project?.selected_agents ?? []) as string[]}
      agents={agents}
      defaultAgentId={project?.default_agent_id ?? null}
      defaultAgentModel={project?.default_agent_model ?? null}
      isUpdating={update.isPending}
      onSetDefaultAgent={(agentId) => update.mutate({ default_agent_id: agentId, default_agent_model: null })}
      onSetDefaultModel={(modelId) => update.mutate({ default_agent_model: modelId })}
    />
  );
};
