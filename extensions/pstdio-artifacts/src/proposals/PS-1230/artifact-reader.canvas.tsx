import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { weeklyActivityHtml } from "../../../examples/weekly-activity";
import { exampleArtifact } from "../../components/artifact-story-fixture";
import { ArtifactTranslationStory } from "../../components/artifact-translation-story";
import { ArtifactReader } from "./artifact-reader";

const content = {
  ...exampleArtifact,
  html: `<title>Release overview</title><h1>Release overview</h1><button onclick="this.textContent='Complete'">Mark complete</button>
<section style="height:12rem;overflow:auto;border:1px solid var(--artifact-border);margin-block:1rem">
${Array.from({ length: 20 }, (_, index) => `<p>Scrollable result ${index + 1}</p>`).join("")}</section>
${Array.from({ length: 24 }, (_, index) => `<p>Document section ${index + 1}</p>`).join("")}`,
};
const meta = {
  title: "Proposals/PS-1230 Artifact page header",
  description:
    "Artifacts open as single-resource pages, like Tickets, without resource tabs. The outlined Versions button is right aligned in the reader panel header. Its bounded dropdown uses ScrollArea and shows each saved version's creation date. Export HTML remains in the breadcrumb actions menu.",
  component: ArtifactReader,
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
        publishedAt: new Date(Date.UTC(2026, 10, 17 - index, 10)).toISOString(),
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
