import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createGlyphIcon, Header, ScopedMenu as Menu, Portal, ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import { weeklyActivityHtml } from "../../examples/weekly-activity";
import type { ArtifactContent, ArtifactSummary } from "../artifacts";
import { ArtifactReader } from "./artifact-reader";
import { exampleArtifact } from "./artifact-story-fixture";
import { ArtifactTranslationStory } from "./artifact-translation-story";

const content = {
  ...exampleArtifact,
  html: `<title>Release overview</title><h1>Release overview</h1><button onclick="this.textContent='Complete'">Mark complete</button>
<section style="height:12rem;overflow:auto;border:1px solid var(--artifact-border);margin-block:1rem">
${Array.from({ length: 20 }, (_, index) => `<p>Scrollable result ${index + 1}</p>`).join("")}</section>
${Array.from({ length: 24 }, (_, index) => `<p>Document section ${index + 1}</p>`).join("")}`,
};
const ChevronDown = createGlyphIcon("arrow-down-1");
const ReaderWithChrome = (props: {
  content: ArtifactContent;
  revisions: ArtifactSummary[];
  onSelect(id: string): void;
}) => (
  <Stack height="full" minHeight="0" gap="0">
    <Header>
      <Text>{props.content.title}</Text>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button variant="ghost" aria-label="Artifact actions">
            <ChevronDown />
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content maxHeight="var(--available-height)">
              <ScrollArea flex="1" minHeight="0" viewportProps={{ tabIndex: -1 }}>
                <Menu.Item value="export">Export HTML</Menu.Item>
                <Menu.Item value="rename">Rename artifact…</Menu.Item>
                <Menu.Item value="delete">Delete artifact…</Menu.Item>
                <Menu.Separator />
                <Menu.ItemGroupLabel>Versions</Menu.ItemGroupLabel>
                <Menu.RadioItemGroup
                  aria-label="Versions"
                  value={props.content.id}
                  onValueChange={(event) => props.onSelect(event.value)}
                >
                  {props.revisions.map((revision, index) => (
                    <Menu.RadioItem key={revision.id} value={revision.id}>
                      <Menu.ItemText truncate>
                        {revision.label || `Version ${props.revisions.length - index}`}
                        {index === 0 ? " · Latest" : ""}
                      </Menu.ItemText>
                      <Menu.ItemIndicator>✓</Menu.ItemIndicator>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioItemGroup>
              </ScrollArea>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </Header>
    <Box flex="1" minHeight="0">
      <ArtifactReader content={props.content} />
    </Box>
  </Stack>
);
const meta = {
  title: "Extensions/Artifacts/Reader",
  description:
    "Export HTML belongs to the artifact actions beside the breadcrumb, with Rename and Delete. The same native resource dropdown contains a Versions radio group; there is no separate reader toolbar. Long histories use the shared ScrollArea. Document and nested preview scrollbars use the same shared thickness and theme colors.",
  component: ReaderWithChrome,
  decorators: [
    (Story) => (
      <ArtifactTranslationStory>
        <Story />
      </ArtifactTranslationStory>
    ),
  ],
  args: {
    content,
    revisions: [exampleArtifact],
    onSelect: () => {},
  },
} satisfies CanvasMeta<typeof ReaderWithChrome>;
export default meta;
type Story = CanvasFrame<typeof meta>;
const InteractiveReader = () => {
  const [manyVersions, setManyVersions] = useState(false);
  const [selectedId, setSelectedId] = useState(exampleArtifact.id);
  const revisions = manyVersions
    ? Array.from({ length: 40 }, (_, index) => ({
        ...exampleArtifact,
        id: `revision-${40 - index}`,
        revisionId: `revision-${40 - index}`,
        label: `Version ${40 - index} — a long saved revision label that should stay within the dropdown`,
      }))
    : [exampleArtifact];
  const selected = revisions.find((revision) => revision.id === selectedId) ?? revisions[0]!;
  return (
    <Stack height="full" minHeight="0" gap="0">
      <Button alignSelf="start" onClick={() => setManyVersions((value) => !value)}>
        {manyVersions ? "Show one version" : "Show many versions"}
      </Button>
      <Box flex="1" minHeight="0" minWidth="0">
        <ReaderWithChrome content={{ ...content, ...selected }} revisions={revisions} onSelect={setSelectedId} />
      </Box>
    </Stack>
  );
};
export const Interactive: Story = {
  id: "extensions-artifacts-reader--interactive",
  render: () => <InteractiveReader />,
};
export const NewRevision: Story = {
  id: "extensions-artifacts-reader--new-revision",
  args: {
    revisions: [{ ...exampleArtifact, id: "revision-2", revisionId: "revision-2", label: "Ready" }, exampleArtifact],
  },
};
export const NarrowHeader: Story = {
  id: "extensions-artifacts-reader--narrow-header",
  decorators: [
    (Story) => (
      <Box width="xs" height="full" data-testid="narrow-reader">
        <Story />
      </Box>
    ),
  ],
  args: { content: { ...content, label: "A longer label for the current version" } },
};
export const Visualization: Story = {
  id: "extensions-artifacts-reader--visualization",
  args: {
    content: { ...content, title: "Weekly activity", html: weeklyActivityHtml },
    revisions: [{ ...exampleArtifact, title: "Weekly activity" }],
  },
};
export const French: Story = {
  id: "extensions-artifacts-reader--french",
  decorators: [
    (Story) => (
      <ArtifactTranslationStory locale="fr">
        <Story />
      </ArtifactTranslationStory>
    ),
  ],
  args: { revisions: [{ ...exampleArtifact, label: undefined }] },
};
