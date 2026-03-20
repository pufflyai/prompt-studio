import { Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useProjectSkill } from "../hooks/use-skills";

interface SkillViewerProps {
  projectId: string | undefined;
  skillName: string;
}

export const SkillViewer = (props: SkillViewerProps) => {
  const { projectId, skillName } = props;
  const { data: skill, isLoading, error } = useProjectSkill(projectId, skillName);

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

  return (
    <Stack height="100%" gap="0">
      <Flex padding="md" borderBottomWidth="1px" justifyContent="center">
        <Stack gap="xs" width="100%" maxWidth="720px">
          <Text textStyle="heading/S" data-testid="project-skill-name">
            {skill.name}
          </Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted" data-testid="project-skill-description">
            {skill.description}
          </Text>
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
