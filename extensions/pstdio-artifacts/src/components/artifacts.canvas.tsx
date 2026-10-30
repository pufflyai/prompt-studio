import { Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
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
    onCreate: () => {},
    loadPreview: async (item) =>
      `<html><body><h1>${item.title}</h1><p>A saved interactive page.</p><h2>Overview</h2><p>Project notes and the next steps.</p></body></html>`,
  },
} satisfies CanvasMeta<typeof ArtifactLibrary>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Published: Story = {
  id: "extensions-artifacts-library--published",
};
export const Empty: Story = {
  id: "extensions-artifacts-library--empty",
  args: { items: [] },
};
export const StartingSession: Story = {
  id: "extensions-artifacts-library--starting-session",
  args: { creating: "brief" },
};
export const ManyArtifacts: Story = {
  id: "extensions-artifacts-library--many-artifacts",
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
export const ScrollableLibrary: Story = {
  id: "extensions-artifacts-library--scrollable-library",
  args: {
    items: Array.from({ length: 30 }, (_, index) => ({
      ...item,
      artifactId: `artifact-${index}`,
      title: `Prototype ${index + 1}`,
    })),
  },
  decorators: [
    (Story) => (
      <Stack height="lg">
        <Story />
      </Stack>
    ),
  ],
};
export const NarrowLibrary: Story = {
  id: "extensions-artifacts-library--narrow-library",
  decorators: [
    (Story) => (
      <Stack width="xs" height="lg">
        <Story />
      </Stack>
    ),
  ],
};
export const UnavailablePreview: Story = {
  id: "extensions-artifacts-library--unavailable-preview",
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
        onCreate={() => {}}
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
export const HostUpdates: Story = {
  id: "extensions-artifacts-library--host-updates",
  render: () => <HostUpdatesLibrary />,
};
export const French: Story = {
  id: "extensions-artifacts-library--french",
  decorators: [
    (Story) => (
      <ArtifactTranslationStory locale="fr">
        <Story />
      </ArtifactTranslationStory>
    ),
  ],
};
