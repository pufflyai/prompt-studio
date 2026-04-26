import { Badge, Box, Button, Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { type SidebarNavigateEvent, SidebarTree } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useEffect, useState } from "react";
import type { ProjectSkillDetails } from "../data/skills-api";
import { useProjectSkill, useUpdateProjectSkill } from "../hooks/use-skills";
import { buildSkillFileTree, collectFolderIds } from "../utils/build-skill-file-tree";
import { parseSkillVersion } from "../utils/parse-skill-version";

interface SkillViewerProps {
  projectId: string | undefined;
  skillName: string;
}

type SkillFile = ProjectSkillDetails["files"][number];

const CONTENT_MAX_WIDTH = "720px";

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
  const treeNodes = buildSkillFileTree(skill.files);
  const initialExpanded = collectFolderIds(treeNodes);
  const [expandedNodes, setExpandedNodes] = useState<string[]>(initialExpanded);
  const [selectedPath, setSelectedPath] = useState(getDefaultFilePath(skill.files));

  useEffect(() => {
    setExpandedNodes(initialExpanded);
  }, [initialExpanded]);

  useEffect(() => {
    setSelectedPath(getDefaultFilePath(skill.files));
  }, [skill.files]);

  const sections = [{ id: "files", nodes: treeNodes, collapsible: false }];

  const selectedFile = skill.files.find((file) => file.path === selectedPath) ?? skill.files[0];
  const skillFile = skill.files.find((file) => file.path === "SKILL.md");
  const currentVersion = parseSkillVersion(skillFile?.content ?? "");
  const hasUpdate = skill.bundled_version && currentVersion !== skill.bundled_version;

  const handleNavigate = (event: SidebarNavigateEvent) => {
    setSelectedPath(event.nodeId);
  };

  const handleToggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => (prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]));
  };

  return (
    <Flex alignItems="flex-start" data-testid="project-skill-content">
      <Box
        position="sticky"
        top="0"
        alignSelf="stretch"
        width="280px"
        minW="220px"
        maxHeight="100vh"
        borderRightWidth="1px"
        padding="sm"
        overflow="auto"
        data-testid="project-skill-file-tree"
      >
        <SidebarTree
          sections={sections}
          expandedSections={["files"]}
          expandedNodes={expandedNodes}
          activeNodeId={selectedFile?.path}
          onToggleSection={() => {}}
          onToggleNode={handleToggleNode}
          onNavigate={handleNavigate}
        />
      </Box>
      <Flex flex="1" justifyContent="center">
        <Stack width="100%" maxWidth={CONTENT_MAX_WIDTH} padding="md" gap="md">
          <Stack gap="xs">
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
          {!selectedFile && (
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              No skill content.
            </Text>
          )}
          {selectedFile && isMarkdown(selectedFile.path) && (
            <MarkdownEditor
              key={`${skill.id}:${selectedFile.path}`}
              defaultState={selectedFile.content}
              isEditable={false}
              scrollable={false}
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
    </Flex>
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
