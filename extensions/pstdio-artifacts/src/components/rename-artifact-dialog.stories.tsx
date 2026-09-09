import type { Meta, StoryObj } from "@storybook/react";
import { ArtifactTranslationStory } from "./artifact-translation-story";
import { RenameArtifactDialog } from "./rename-artifact-dialog";

const meta = {
  title: "Extensions/Artifacts/Rename",
  component: RenameArtifactDialog,
  decorators: [
    (Story) => (
      <ArtifactTranslationStory>
        <Story />
      </ArtifactTranslationStory>
    ),
  ],
  args: { name: "Release overview", onRename: async () => {}, onClose: () => {} },
} satisfies Meta<typeof RenameArtifactDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Rename: Story = {};
export const Failure: Story = {
  args: {
    onRename: async () => {
      throw new Error("Could not rename the artifact. Try again.");
    },
  },
};
