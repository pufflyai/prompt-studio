import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { TimelineFromJSON } from "./timeline";

const meta = {
  title: "Patterns/Chat/Timeline",
  component: TimelineFromJSON,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TimelineFromJSON>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Diff: Story = {
  args: {
    data: {
      items: [
        {
          title: [{ kind: "text", text: "Updated greeting" }],
          blocks: [
            {
              type: "diff",
              language: "typescript",
              original: 'const greeting = "hello";\n',
              modified: 'const greeting = "welcome";\n',
            },
          ],
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Updated greeting"));
    await expect(await canvas.findByRole("row", { name: /welcome/ })).toBeVisible();
  },
};
