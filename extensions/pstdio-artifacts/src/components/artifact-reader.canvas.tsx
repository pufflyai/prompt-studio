import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { weeklyActivityHtml } from "../../examples/weekly-activity";
import { ArtifactReader } from "./artifact-reader";
import { exampleArtifact } from "./artifact-story-fixture";
import { ArtifactTranslationStory } from "./artifact-translation-story";

const content = {
  ...exampleArtifact,
  html: "<title>Release overview</title><h1>Release overview</h1><button onclick=\"this.textContent='Complete'\">Mark complete</button>",
};
const meta = {
  title: "Extensions/Artifacts/Reader",
  component: ArtifactReader,
  decorators: [
    (Story) => (
      <ArtifactTranslationStory>
        <Story />
      </ArtifactTranslationStory>
    ),
    (Story) => (
      <Box height="100dvh">
        <Story />
      </Box>
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
export const Interactive: Story = {
  id: "extensions-artifacts-reader--interactive",
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
