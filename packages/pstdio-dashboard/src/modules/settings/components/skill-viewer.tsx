import { Badge, Box, Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, TreeList, type TreeListNavigateEvent } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useEffect, useMemo, useState } from "react";
import type { ProjectSkillDetails } from "../data/skills-api";
import { useProjectSkill } from "../data/use-skills";
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

export const SkillViewerContent = (props: { skill: ProjectSkillDetails }) => {
  const { skill } = props;
  const treeNodes = useMemo(() => buildSkillFileTree(skill.files), [skill.files]);
  const initialExpanded = useMemo(() => collectFolderIds(treeNodes), [treeNodes]);
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

  const handleNavigate = (event: TreeListNavigateEvent) => {
    setSelectedPath(event.nodeId);
  };

  const handleToggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => (prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]));
  };

  return (
    <Flex h="full" minH="0" minW="0" overflow="hidden" data-testid="project-skill-content">
      <ScrollArea
        h="full"
        minH="0"
        width="280px"
        minW="220px"
        flexShrink="0"
        borderRightWidth="1px"
        viewportProps={{ style: { overflowX: "hidden" } }}
        contentProps={{ style: { minWidth: "100%", width: "100%" } }}
        data-testid="project-skill-file-tree"
      >
        <TreeList
          sections={sections}
          expandedSectionIds={["files"]}
          expandedNodeIds={expandedNodes}
          activeNodeId={selectedFile?.path}
          rowVariant="tree"
          onToggleNode={handleToggleNode}
          onNavigate={handleNavigate}
        />
      </ScrollArea>
      <ScrollArea flex="1" minH="0" minW="0" data-testid="project-skill-editor-scroll">
        <Flex justifyContent="center" minW="0">
          <Stack width="100%" maxWidth={CONTENT_MAX_WIDTH} padding="md" gap="md" minW="0">
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
              <ScrollArea borderWidth="1px" borderRadius="sm" showHorizontalScrollbar contentProps={{ p: "sm" }}>
                <Box
                  as="pre"
                  margin="0"
                  fontFamily="mono"
                  whiteSpace="pre-wrap"
                  data-testid="project-skill-code-content"
                >
                  {selectedFile.content}
                </Box>
              </ScrollArea>
            )}
          </Stack>
        </Flex>
      </ScrollArea>
    </Flex>
  );
};

export const SkillViewer = (props: SkillViewerProps) => {
  const { projectId, skillName } = props;
  const { data: skill, isLoading, error } = useProjectSkill(projectId, skillName);

  if (isLoading) {
    return (
      <Flex h="full" minH="0" flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Spinner />
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex h="full" minH="0" flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {error instanceof Error ? error.message : "Failed to load skill."}
        </Text>
      </Flex>
    );
  }

  if (!skill) {
    return (
      <Flex h="full" minH="0" flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Skill not found.
        </Text>
      </Flex>
    );
  }

  return <SkillViewerContent skill={skill} />;
};
