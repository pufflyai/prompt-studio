import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ReactNode } from "react";
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
} satisfies CanvasMeta<typeof Slider>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const SquareTrack: Story = {
  id: "components-inputs-slider--square-track",
};
