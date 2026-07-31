import { Description, Primary, Title } from "@storybook/addon-docs/blocks";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbenchCore } from "../../core";
import { dataTableRendererSource } from "../onboarding/data-table-renderer-source";
import { WorkbenchStory } from "../workbench-story";
import { createDataTableRendererStoryModule } from "./module";

const workbench = createWorkbenchCore();
workbench.registerModule(createDataTableRendererStoryModule());

const DataTableRendererDocs = () => (
  <>
    <Title />
    <Description />
    <Primary />
  </>
);

const meta = {
  title: "pstdio-workbench/Onboarding/21. Data table renderer",
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
          "Register a DataTable renderer with multiple-row selection and actions that receive the original selected rows. Select services and run the contribution's bulk restart action from the selection toolbar.",
      },
      page: DataTableRendererDocs,
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
      canvas: { sourceState: "shown" },
      source: {
        code: dataTableRendererSource,
        language: "tsx",
        type: "code",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rowSelectors = canvas.getAllByLabelText("Select row");

    await userEvent.click(rowSelectors[0]!);
    await expect(canvas.getByText("1 rows selected")).toBeInTheDocument();
    await userEvent.click(rowSelectors[1]!);

    await expect(canvas.getByText("2 rows selected")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Restart selected" })).toBeInTheDocument();
  },
};
