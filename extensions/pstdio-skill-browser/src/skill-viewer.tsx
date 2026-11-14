import { Accordion, Box, Flex, IconButton, Stack, Text } from "@chakra-ui/react";
import type { Skill } from "@pstdio/sdk/resources";
import {
  getIconComponent,
  Header,
  ResizableSplitLayout,
  ScrollArea,
  TreeList,
  useFileIconThemePreference,
} from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useState } from "react";
import { buildSkillFileTree, collectFolderIds } from "./build-skill-file-tree";
import { parseSkillMetadata } from "./parse-skill-metadata";

const PanelLeft = getIconComponent("panel-left");
const X = getIconComponent("x");

export const SkillViewerContent = (props: { skill: Skill }) => {
  const { skill } = props;
  const { activeFileIconTheme } = useFileIconThemePreference();
  const nodes = buildSkillFileTree(skill.files, activeFileIconTheme);
  const [expandedNodes, setExpandedNodes] = useState(() => collectFolderIds(nodes));
  const [selectedPath, setSelectedPath] = useState("SKILL.md");
  const [collapsed, setCollapsed] = useState(false);
  const selectedFile = skill.files.find((file) => file.path === selectedPath) ?? skill.files[0];
  const metadata = parseSkillMetadata(skill.files.find((file) => file.path === "SKILL.md")?.content ?? "");
  const details = (
    <Flex direction="column" h="full" minH="0" minW="0" bg="bg.subtle">
      <Header variant="narrow" borderBottomWidth="1px" flexShrink="0">
        <Text flex="1" textStyle="label/S/medium">
          Skill details
        </Text>
        <IconButton size="xs" variant="ghost" aria-label="Close skill details" onClick={() => setCollapsed(true)}>
          <X />
        </IconButton>
      </Header>
      <Accordion.Root multiple defaultValue={["info", "files"]} flex="1" minH="0" display="flex" flexDirection="column">
        <Accordion.Item value="info" flexShrink="0">
          <Accordion.ItemTrigger px="sm" py="xs">
            <Text flex="1" textStyle="label/S/medium">
              Info
            </Text>
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <ScrollArea maxH="64" contentProps={{ p: "sm" }}>
              <Stack
                gap="xs"
                textStyle="paragraph/S/regular"
                overflowWrap="anywhere"
                data-testid="project-skill-metadata"
              >
                <Text>{metadata.name || skill.name}</Text>
                {metadata.version && <Text color="fg.muted">Version {metadata.version}</Text>}
                <Text color="fg.muted" whiteSpace="pre-wrap" data-testid="project-skill-description">
                  {metadata.description || skill.description || "No description."}
                </Text>
              </Stack>
            </ScrollArea>
          </Accordion.ItemContent>
        </Accordion.Item>
        <Accordion.Item value="files" flex="1" minH="0" display="flex" flexDirection="column">
          <Accordion.ItemTrigger px="sm" py="xs" flexShrink="0">
            <Text flex="1" textStyle="label/S/medium">
              Files
            </Text>
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent flex="1" minH="0">
            <ScrollArea h="full" minH="0" data-testid="project-skill-file-tree">
              <TreeList
                sections={[{ id: "files", nodes, collapsible: false }]}
                expandedSectionIds={["files"]}
                expandedNodeIds={expandedNodes}
                activeNodeId={selectedFile?.path}
                rowVariant="tree"
                onToggleNode={(id) =>
                  setExpandedNodes((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))
                }
                onNavigate={({ nodeId }) => setSelectedPath(nodeId)}
              />
            </ScrollArea>
          </Accordion.ItemContent>
        </Accordion.Item>
      </Accordion.Root>
    </Flex>
  );
  const content = (
    <Flex direction="column" h="full" minH="0" minW="0">
      <Header variant="narrow" borderBottomWidth="1px" flexShrink="0" gap="xs">
        {collapsed && (
          <IconButton size="xs" variant="ghost" aria-label="Show skill details" onClick={() => setCollapsed(false)}>
            <PanelLeft />
          </IconButton>
        )}
        <Text textStyle="label/S/medium" truncate>
          {selectedFile?.path ?? skill.title}
        </Text>
      </Header>
      <ScrollArea flex="1" minH="0" minW="0" data-testid="project-skill-editor-scroll">
        <Stack p="md" minW="0">
          {!selectedFile && <Text color="fg.muted">No skill content.</Text>}
          {selectedFile?.path.toLowerCase().endsWith(".md") && (
            <MarkdownEditor
              key={`${skill.id}:${selectedFile.path}`}
              defaultState={selectedFile.content}
              isEditable={false}
              scrollable={false}
              placeholder="No content."
            />
          )}
          {selectedFile && !selectedFile.path.toLowerCase().endsWith(".md") && (
            <Box as="pre" m="0" fontFamily="mono" whiteSpace="pre-wrap" data-testid="project-skill-code-content">
              {selectedFile.content}
            </Box>
          )}
        </Stack>
      </ScrollArea>
    </Flex>
  );
  return (
    <ResizableSplitLayout
      h="full"
      minH="0"
      minW="0"
      defaultSizePx={260}
      minSizePx={180}
      maxSizePx={480}
      contentMinSizePx={280}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      resizeLabel="Resize skill details"
      separator="line"
      resizablePanel={details}
      contentPanel={content}
      data-testid="project-skill-content"
    />
  );
};
