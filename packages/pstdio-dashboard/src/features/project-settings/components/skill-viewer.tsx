import { Badge, Button, Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useProjectSkill, useUpdateProjectSkill } from "../hooks/use-skills";
import { parseSkillVersion } from "../utils/parse-skill-version";

interface SkillViewerProps {
  projectId: string | undefined;
  skillName: string;
}

export const SkillViewer = (props: SkillViewerProps) => {
  const { projectId, skillName } = props;
  const { data: skill, isLoading, error } = useProjectSkill(projectId, skillName);
  const updateSkill = useUpdateProjectSkill(projectId, skillName);

  if (isLoading) {
    return (
      <Flex flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Spinner />
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {error instanceof Error ? error.message : "Failed to load skill."}
        </Text>
      </Flex>
    );
  }

  if (!skill) {
    return (
      <Flex flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Skill not found.
        </Text>
      </Flex>
    );
  }

  const currentVersion = parseSkillVersion(skill.content);
  const hasUpdate = skill.bundled_version && currentVersion !== skill.bundled_version;

  return (
    <Stack height="100%" gap="0">
      <Flex padding="md" borderBottomWidth="1px" justifyContent="center">
        <Stack gap="xs" width="100%" maxWidth="720px">
          <Flex alignItems="center" gap="sm">
            <Text textStyle="heading/S" data-testid="project-skill-name">
              {skill.name}
            </Text>
            {currentVersion && (
              <Badge size="sm" data-testid="project-skill-version">
                v{currentVersion}
              </Badge>
            )}
            {hasUpdate && (
              <Button
                size="xs"
                variant="outline"
                loading={updateSkill.isPending}
                onClick={() => updateSkill.mutate()}
                data-testid="project-skill-update-button"
              >
                Update to v{skill.bundled_version}
              </Button>
            )}
          </Flex>
          <Flex alignItems="center" gap="sm">
            <Text textStyle="paragraph/S/regular" color="fg.muted" data-testid="project-skill-description">
              {skill.description}
            </Text>
          </Flex>
          {skill.installed_agents.length > 0 && (
            <Flex gap="xs" data-testid="project-skill-installed-agents">
              {skill.installed_agents.map((agentId) => (
                <Badge key={agentId} size="sm" colorPalette="green">
                  {agentId}
                </Badge>
              ))}
            </Flex>
          )}
          {skill.installed_agents.length === 0 && (
            <Text textStyle="paragraph/XS/regular" color="fg.muted" data-testid="project-skill-not-installed">
              Not installed locally
            </Text>
          )}
        </Stack>
      </Flex>
      <Stack flex="1" minH="0" padding="sm" overflow="auto" data-testid="project-skill-content">
        <MarkdownEditor
          key={skill.id}
          defaultState={skill.content}
          isEditable={false}
          placeholder="No skill content."
        />
      </Stack>
    </Stack>
  );
};
