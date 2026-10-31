import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { MissingResourceBadge, ResourceBadge } from "@/components/primitives/resource-badge";

const meta: CanvasMeta<typeof ResourceBadge> = {
  title: "Components/Data Display/Resource Badge",
  component: ResourceBadge,
};
export default meta;
type Story = CanvasFrame<typeof ResourceBadge>;
export const Default: Story = {
  id: "components-data-display-resource-badge--default",
  args: {
    fileName: "workspace/analysis/report.md",
    tone: "neutral",
    size: "md",
  },
};
export const Missing: Story = {
  id: "components-data-display-resource-badge--missing",
  render: () => <MissingResourceBadge referenceId="missing/resource.md" />,
};
export const WithoutTooltip: Story = {
  id: "components-data-display-resource-badge--without-tooltip",
  args: { ...Default.args, tooltip: false },
};
