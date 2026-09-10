import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
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
    onBack: () => {},
    onRename: async () => {},
    onDelete: async () => {},
  },
} satisfies Meta<typeof ArtifactReader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const NewRevision: Story = {
  args: {
    revisions: [{ ...exampleArtifact, id: "revision-2", revisionId: "revision-2", label: "Ready" }, exampleArtifact],
  },
};

export const Visualization: Story = {
  args: {
    content: { ...content, title: "Weekly activity", html: weeklyActivityHtml },
    revisions: [{ ...exampleArtifact, title: "Weekly activity" }],
  },
};

export const French: Story = {
  decorators: [
    (Story) => (
      <ArtifactTranslationStory locale="fr">
        <Story />
      </ArtifactTranslationStory>
    ),
  ],
  args: { revisions: [{ ...exampleArtifact, label: undefined }] },
};
