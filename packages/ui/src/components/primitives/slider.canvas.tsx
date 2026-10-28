import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { expect } from "storybook/test";

import { Slider } from "@/components/primitives/slider";

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
    const thumb = canvasElement.querySelector('[data-scope="slider"][data-part="thumb"]');

    await expect(track).not.toBeNull();
    await expect(thumb).not.toBeNull();
    if (!track) return;
    if (!thumb) return;

    await expect(getComputedStyle(track).borderRadius).toBe("0px");
    await expect(getComputedStyle(thumb).borderRadius).toBe("4px");
    await expect(getComputedStyle(thumb).width).toBe("10px");
  },
};
