import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Chip } from "./chip";

const meta = {
  title: "Design system/Components/Data display/Chip",
  component: Chip,
  args: {
    children: "Bug",
  },
} satisfies CanvasMeta<typeof Chip>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Default: Story = {
  id: "components-data-display-chip--default",
};
