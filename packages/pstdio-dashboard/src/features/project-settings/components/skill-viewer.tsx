import { Badge, Box, Button, Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useEffect, useMemo, useState } from "react";
import type { ProjectSkillDetails } from "../data/skills-api";
import { useProjectSkill, useUpdateProjectSkill } from "../hooks/use-skills";
import { parseSkillVersion } from "../utils/parse-skill-version";

interface SkillViewerProps {
  projectId: string | undefined;
  skillName: string;
}

type SkillFile = ProjectSkillDetails["files"][number];

const sortSkillFiles = (files: SkillFile[]) => {
  return [...files].sort((a, b) => {
    if (a.path === "SKILL.md") return -1;
    if (b.path === "SKILL.md") return 1;
    return a.path.localeCompare(b.path);
  });
};

const getDefaultFilePath = (files: SkillFile[]) => {
  return files.find((file) => file.path === "SKILL.md")?.path ?? files[0]?.path ?? "";
};

const isMarkdown = (path: string) => path.toLowerCase().endsWith(".md");

export const SkillViewerContent = (props: {
  skill: ProjectSkillDetails;
  isUpdating: boolean;
  onUpdate: () => void;
}) => {
  const { skill, isUpdating, onUpdate } = props;
  const files = useMemo(() => sortSkillFiles(skill.files), [skill.files]);
  const [selectedPath, setSelectedPath] = useState(getDefaultFilePath(files));

  useEffect(() => {
    setSelectedPath(getDefaultFilePath(files));
  }, [files]);

  const selectedFile = files.find((file) => file.path === selectedPath) ?? files[0];
  const skillFile = files.find((file) => file.path === "SKILL.md");
  const currentVersion = parseSkillVersion(skillFile?.content ?? "");
  const hasUpdate = skill.bundled_version && currentVersion !== skill.bundled_version;

  return (
    <Stack height="100%" gap="0">
      <Flex padding="md" borderBottomWidth="1px" justifyContent="center">
        <Stack gap="xs" width="100%" maxWidth="900px">
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
                loading={isUpdating}
                onClick={onUpdate}
                data-testid="project-skill-update-button"
              >
                Update to v{skill.bundled_version}
              </Button>
            )}
          </Flex>
          <Text textStyle="paragraph/S/regular" color="fg.muted" data-testid="project-skill-description">
            {skill.description}
          </Text>
          {skill.installed_agents.length > 0 ? (
            <Flex gap="xs" data-testid="project-skill-installed-agents">
              {skill.installed_agents.map((agentId) => (
                <Badge key={agentId} size="sm" colorPalette="green">
                  {agentId}
                </Badge>
              ))}
            </Flex>
          ) : (
            <Text textStyle="paragraph/XS/regular" color="fg.muted" data-testid="project-skill-not-installed">
              Not installed locally
            </Text>
          )}
        </Stack>
      </Flex>
      <Flex flex="1" minH="0" data-testid="project-skill-content">
        <Stack
          width="280px"
          minW="220px"
          borderRightWidth="1px"
          padding="sm"
          gap="2xs"
          overflow="auto"
          data-testid="project-skill-file-tree"
        >
          {files.map((file) => (
            <Button
              key={file.path}
              size="xs"
              justifyContent="flex-start"
              variant={selectedFile?.path === file.path ? "subtle" : "ghost"}
              onClick={() => setSelectedPath(file.path)}
              data-testid={`project-skill-file-${file.path.replaceAll("/", "-")}`}
            >
              {file.path}
            </Button>
          ))}
        </Stack>
        <Stack flex="1" minH="0" padding="sm" overflow="auto">
          {!selectedFile && (
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              No skill content.
            </Text>
          )}
          {selectedFile && isMarkdown(selectedFile.path) && (
            <MarkdownEditor
              key={selectedFile.path}
              defaultState={selectedFile.content}
              isEditable={false}
              placeholder="No content."
            />
          )}
          {selectedFile && !isMarkdown(selectedFile.path) && (
            <Box
              as="pre"
              margin="0"
              borderWidth="1px"
              borderRadius="sm"
              padding="sm"
              fontFamily="mono"
              whiteSpace="pre-wrap"
              overflow="auto"
              data-testid="project-skill-code-content"
            >
              {selectedFile.content}
            </Box>
          )}
        </Stack>
      </Flex>
    </Stack>
  );
};

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

  return <SkillViewerContent skill={skill} isUpdating={updateSkill.isPending} onUpdate={() => updateSkill.mutate()} />;
};
