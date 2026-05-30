import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { expect } from "storybook/test";

import { Slider } from "./slider";

const meta = {
  title: "Components/Inputs/Slider",
  component: Slider,
  args: {
    min: 0,
    max: 100,
    defaultValue: [40],
  },
  decorators: [
    (Story: () => ReactNode) => (
      <div style={{ padding: "24px", width: "320px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Slider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SquareTrack: Story = {
  play: async ({ canvasElement }) => {
    const track = canvasElement.querySelector('[data-scope="slider"][data-part="track"]');

    await expect(track).not.toBeNull();
    if (!track) return;

    const borderRadius = getComputedStyle(track).borderRadius;
    await expect(borderRadius).toBe("0px");
  },
};
