import { Badge, Box, Button, Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, TreeList, type TreeListNavigateEvent, toaster, useFileIconThemePreference } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ProjectSkillDetails } from "../data/skills-api";
import { useProjectSkill, useUpdateProjectSkillInstallation } from "../data/use-skills";
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

const installedVersionLabel = (version: string | null) => (version ? `v${version}` : "unknown");

export const SkillViewerContent = (props: { skill: ProjectSkillDetails }) => {
  const { skill } = props;
  const { activeFileIconTheme } = useFileIconThemePreference();
  const treeNodes = useMemo(
    () => buildSkillFileTree(skill.files, activeFileIconTheme),
    [skill.files, activeFileIconTheme],
  );
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
  const canUpdateSkill =
    skill.source_kind === "extension" && skill.agent_installations.some((installation) => installation.outdated);
  const updateSkill = useUpdateProjectSkillInstallation(skill.project_id, skill.name);

  const handleNavigate = (event: TreeListNavigateEvent) => {
    setSelectedPath(event.nodeId);
  };

  const handleToggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => (prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]));
  };

  const handleUpdateSkill = async () => {
    try {
      await updateSkill.mutateAsync();
    } catch (error) {
      toaster.create({
        type: "error",
        title: "Skill update failed",
        description: error instanceof Error ? error.message : skill.name,
      });
    }
  };

  return (
    <Flex h="full" minH="0" minW="0" overflow="hidden" data-testid="project-skill-content">
      <Flex h="full" minH="0" width="280px" minW="220px" flexShrink="0" borderRightWidth="1px" direction="column">
        <Box flexShrink="0" borderBottomWidth="1px" padding="sm">
          {skill.agent_installations.length > 0 ? (
            <Stack gap="xs" data-testid="project-skill-agent-installations">
              {skill.agent_installations.map((installation) => (
                <Flex key={installation.agent_id} alignItems="center" gap="xs" minW="0">
                  <Text textStyle="label/S/regular" flex="1" minW="0" truncate>
                    {installation.agent_name}
                  </Text>
                  <Badge size="sm" data-testid="project-skill-installed-version">
                    {installedVersionLabel(installation.installed_version)}
                  </Badge>
                  {installation.outdated && (
                    <Badge size="sm" colorPalette="orange" data-testid="project-skill-agent-outdated">
                      Out of date
                    </Badge>
                  )}
                </Flex>
              ))}
            </Stack>
          ) : (
            <Text textStyle="paragraph/XS/regular" color="fg.muted" data-testid="project-skill-not-installed">
              Not installed locally
            </Text>
          )}
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
          <Stack width="100%" maxWidth={CONTENT_MAX_WIDTH} padding="md" gap="md" minW="0">
            <Stack gap="xs">
              <Flex alignItems="flex-start" justifyContent="space-between" gap="sm" wrap="wrap">
                <Flex alignItems="center" gap="sm" minW="0" flex="1" wrap="wrap">
                  <Text textStyle="heading/S" data-testid="project-skill-name">
                    {skill.name}
                  </Text>
                  {currentVersion && (
                    <Badge size="sm" data-testid="project-skill-version">
                      v{currentVersion}
                    </Badge>
                  )}
                  {canUpdateSkill && (
                    <Badge size="sm" colorPalette="orange" data-testid="project-skill-outdated">
                      Out of date
                    </Badge>
                  )}
                </Flex>
                {canUpdateSkill && (
                  <Button
                    size="sm"
                    variant="outline"
                    flexShrink="0"
                    onClick={handleUpdateSkill}
                    loading={updateSkill.isPending}
                    data-testid="project-skill-update"
                  >
                    <RefreshCw size={14} />
                    {currentVersion ? `Update to v${currentVersion}` : "Update skill"}
                  </Button>
                )}
              </Flex>
              <Text textStyle="paragraph/S/regular" color="fg.muted" data-testid="project-skill-description">
                {skill.description}
              </Text>
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
