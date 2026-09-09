import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ArtifactLibrary } from "./artifact-library";
import { exampleArtifact as item } from "./artifact-story-fixture";
import { ArtifactTranslationStory } from "./artifact-translation-story";

const meta = {
  title: "Extensions/Artifacts/Library",
  component: ArtifactLibrary,
  decorators: [
    (Story) => (
      <ArtifactTranslationStory>
        <Story />
      </ArtifactTranslationStory>
    ),
  ],
  args: {
    items: [item],
    onOpen: () => {},
    loadPreview: async (item) =>
      `<html><body><h1>${item.title}</h1><p>A saved interactive page.</p><h2>Overview</h2><p>Project notes and the next steps.</p></body></html>`,
  },
} satisfies Meta<typeof ArtifactLibrary>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Published: Story = {};
export const Empty: Story = { args: { items: [] } };
export const ManyArtifacts: Story = {
  args: {
    items: [
      "Release overview",
      "Research notes",
      "Experiment tracker",
      "Team handbook",
      "Sprint overview",
      "A long investigation title that should remain readable in a compact library",
    ].map((title, index) => ({ ...item, artifactId: `artifact-${index}`, title })),
  },
};
export const UnavailablePreview: Story = {
  args: {
    loadPreview: async () => {
      throw new Error("Preview unavailable");
    },
  },
};

const HostUpdatesLibrary = () => {
  const [updates, setUpdates] = useState(0);
  return (
    <Stack height="full">
      <Text>Host updates: {updates}</Text>
      <ArtifactLibrary
        items={[item]}
        onOpen={() => {}}
        loadPreview={async () => {
          setUpdates(updates + 1);
          // Command completion updates host props before its result reaches the webview.
          await new Promise((resolve) => setTimeout(resolve, 50));
          return "<h1>Saved preview</h1>";
        }}
      />
    </Stack>
  );
};

export const HostUpdates: Story = { render: () => <HostUpdatesLibrary /> };

export const French: Story = {
  decorators: [
    (Story) => (
      <ArtifactTranslationStory locale="fr">
        <Story />
      </ArtifactTranslationStory>
    ),
  ],
};
