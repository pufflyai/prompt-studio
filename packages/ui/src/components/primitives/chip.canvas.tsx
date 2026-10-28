import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { Chip } from "./chip";

const meta = {
  title: "Components/Data Display/Chip",
  component: Chip,
  args: {
    children: "Bug",
  },
} satisfies CanvasMeta<typeof Chip>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Default: Story = {
  id: "components-data-display-chip--default",
};
