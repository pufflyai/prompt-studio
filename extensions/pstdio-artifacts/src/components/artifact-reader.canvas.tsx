import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createGlyphIcon, Header, ResourceActionMenu } from "@pstdio/ui";
import { useState } from "react";
import { weeklyActivityHtml } from "../../examples/weekly-activity";
import { ArtifactReader } from "./artifact-reader";
import { exampleArtifact } from "./artifact-story-fixture";
import { ArtifactTranslationStory } from "./artifact-translation-story";

const content = {
  ...exampleArtifact,
  html: "<title>Release overview</title><h1>Release overview</h1><button onclick=\"this.textContent='Complete'\">Mark complete</button>",
};
const ChevronDown = createGlyphIcon("arrow-down-1");
const meta = {
  title: "Extensions/Artifacts/Reader",
  description:
    "Export HTML belongs to the artifact actions beside the breadcrumb, with Rename and Delete. Versions is an outlined, right-aligned dropdown with a bounded trigger and a ScrollArea for long lists.",
  component: ArtifactReader,
  decorators: [
    (Story) => (
      <ArtifactTranslationStory>
        <Story />
      </ArtifactTranslationStory>
    ),
    (Story) => (
      <Stack height="100dvh" gap="0">
        <Header>
          <Text>{content.title}</Text>
          <ResourceActionMenu
            actions={[
              { key: "rename", label: "Rename artifact…" },
              { key: "export", label: "Export HTML", onClick: () => {} },
              { key: "delete", label: "Delete artifact…" },
            ]}
          >
            <Button variant="ghost" aria-label="Artifact actions">
              <ChevronDown />
            </Button>
          </ResourceActionMenu>
        </Header>
        <Box flex="1" minH="0">
          <Story />
        </Box>
      </Stack>
    ),
  ],
  args: {
    content,
    revisions: [exampleArtifact],
    onSelect: () => {},
  },
} satisfies CanvasMeta<typeof ArtifactReader>;
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
        <ArtifactReader content={{ ...content, ...selected }} revisions={revisions} onSelect={setSelectedId} />
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
