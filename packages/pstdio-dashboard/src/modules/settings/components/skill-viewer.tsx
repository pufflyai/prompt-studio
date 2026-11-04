import { Box, Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, TreeList, type TreeListNavigateEvent, useFileIconThemePreference } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useEffect, useState } from "react";
import type { ProjectSkillDetails } from "../data/skills-api";
import { useProjectSkill } from "../data/use-skills";
import { buildSkillFileTree, collectFolderIds } from "../utils/build-skill-file-tree";
import { parseSkillMetadata } from "../utils/parse-skill-metadata";

interface SkillViewerProps {
  projectId: string | undefined;
  skillName: string;
}

type SkillFile = ProjectSkillDetails["files"][number];

const getDefaultFilePath = (files: SkillFile[]) => {
  return files.find((file) => file.path === "SKILL.md")?.path ?? files[0]?.path ?? "";
};

const isMarkdown = (path: string) => path.toLowerCase().endsWith(".md");

export const SkillViewerContent = (props: { skill: ProjectSkillDetails }) => {
  const { skill } = props;
  const { activeFileIconTheme } = useFileIconThemePreference();
  const treeNodes = buildSkillFileTree(skill.files, activeFileIconTheme);
  const [expandedNodes, setExpandedNodes] = useState(() => collectFolderIds(treeNodes));
  const [selectedPath, setSelectedPath] = useState(getDefaultFilePath(skill.files));

  // Keyed on the source inputs, not on the derived tree, so the reset does not depend on memoized identities.
  useEffect(() => {
    setExpandedNodes(collectFolderIds(buildSkillFileTree(skill.files, activeFileIconTheme)));
  }, [skill.files, activeFileIconTheme]);

  useEffect(() => {
    setSelectedPath(getDefaultFilePath(skill.files));
  }, [skill.files]);

  const sections = [{ id: "files", nodes: treeNodes, collapsible: false }];

  const selectedFile = skill.files.find((file) => file.path === selectedPath) ?? skill.files[0];

  const metadata = parseSkillMetadata(skill.files.find((file) => file.path === "SKILL.md")?.content ?? "");

  const handleNavigate = (event: TreeListNavigateEvent) => {
    setSelectedPath(event.nodeId);
  };

  const handleToggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => (prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]));
  };

  return (
    <Flex h="full" minH="0" minW="0" overflow="hidden" data-testid="project-skill-content">
      <Flex h="full" minH="0" width="64" minW="48" flexShrink="0" borderRightWidth="1px" direction="column">
        <ScrollArea maxH="1/2" flexShrink="0" minH="0" contentProps={{ p: "md" }}>
          <Stack gap="sm" textStyle="paragraph/S/regular" overflowWrap="anywhere" data-testid="project-skill-metadata">
            <Text>Name: {metadata.name || skill.name}</Text>
            <Text>Version: {metadata.version || "Unknown"}</Text>
            <Stack gap="xs">
              <Text>Description:</Text>
              <Text color="fg.muted" whiteSpace="pre-wrap" data-testid="project-skill-description">
                {metadata.description || skill.description || "No description."}
              </Text>
            </Stack>
          </Stack>
        </ScrollArea>
        <Box borderTopWidth="1px" borderBottomWidth="1px" p="sm">
          <Text textStyle="label/S/medium">Files</Text>
        </Box>
        <ScrollArea
          flex="1"
          minH="0"
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
      </Flex>
      <ScrollArea flex="1" minH="0" minW="0" data-testid="project-skill-editor-scroll">
        <Flex justifyContent="center" minW="0">
          <Stack width="full" padding="md" gap="md" minW="0">
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
