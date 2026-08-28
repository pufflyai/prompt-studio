import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbenchCore } from "../../core";
import { WorkbenchStory } from "../workbench-story";
import { createGenericCollectionRendererModule } from "./module";

const meta = {
  title: "pstdio-workbench/Examples/Generic collection renderer",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const workbench = createWorkbenchCore();
workbench.registerModule(createGenericCollectionRendererModule());

export const ExtensionOwnedRules: Story = {
  render: () => <WorkbenchStory workbench={workbench} />,
};
