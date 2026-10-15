import type { Meta, StoryObj } from "@storybook/react";
import type { WindowingFixture } from "./fixture";
import { IntegratedWindowingControls } from "./integrated-controls";
import { createIntegratedWindowingFixture } from "./integrated-fixture";
import { exerciseIntegratedOwnership } from "./integrated-ownership-play";
import { exerciseIntegratedModes, exerciseIntegratedResources } from "./integrated-resources-play";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "One continuous journey through page and mode ownership, retained drafts, reset, reload, fullscreen, background session starts, resource editors and the real mode examples. Lifecycle counters use an in-memory adapter; they do not prove backend or terminal continuity.",
      },
    },
  },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;
let fixture: WindowingFixture;
const args = {
  controls: IntegratedWindowingControls,
  createFixture: () => {
    fixture = createIntegratedWindowingFixture();
    return fixture;
  },
};
const play: Story["play"] = async ({ canvasElement }) => {
  await exerciseIntegratedOwnership(canvasElement, fixture);
  await exerciseIntegratedResources(canvasElement);
  await exerciseIntegratedModes(canvasElement, fixture);
};

export const IntegratedLight: Story = { args: { ...args, initialThemePreference: "pstdio-light" }, play };
export const IntegratedDark: Story = { args: { ...args, initialThemePreference: "pstdio-dark" }, play };
