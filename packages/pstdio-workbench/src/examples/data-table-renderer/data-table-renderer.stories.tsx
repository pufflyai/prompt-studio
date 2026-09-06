import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../workbench-story";
import { createDataTableRendererStoryModule } from "./module";
import source from "./module.tsx?raw";

const workbench = createWorkbench();
workbench.registerModule(createDataTableRendererStoryModule());

const meta = {
  title: "pstdio-workbench/Reference/Core API/Native data table",
  component: WorkbenchStory,
  tags: ["autodocs"],
  args: { workbench },
  argTypes: {
    workbench: { table: { disable: true } },
  },
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          "The Core API registration used by the host adapter for the native data table. Extension authors declare the dataTable view body shown in Extension onboarding.",
      },
    },
    layout: "fullscreen",
  },
} satisfies Meta<typeof WorkbenchStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MultipleSelection: Story = {
  name: "Multiple selection",
  parameters: {
    docs: {
      description: {
        story: "Select services and run the contribution's bulk restart action from the selection toolbar.",
      },
      source: { code: source, language: "tsx", type: "code" },
    },
  },
};
