import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { MissingResourceBadge, ResourceBadge } from "@/components/primitives/resource-badge";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";

const meta: CanvasMeta<typeof ResourceBadge> = {
  title: "Design system/Components/Data display/Resource badge",
  component: ResourceBadge,
};
export default {
  title: "Design system/Components/Data display/Resource badge",
  fullscreen: true,
};
type Story = CanvasFrame<typeof ResourceBadge>;
const Default: Story = {
  id: "components-data-display-resource-badge--default",
  args: {
    fileName: "workspace/analysis/report.md",
    tone: "neutral",
    size: "md",
  },
};
const Missing: Story = {
  id: "components-data-display-resource-badge--missing",
  render: () => <MissingResourceBadge referenceId="missing/resource.md" />,
};
const WithoutTooltip: Story = {
  id: "components-data-display-resource-badge--without-tooltip",
  args: { ...Default.args, tooltip: false },
};

const Examples = createCanvasExampleNavigator(meta, { Default, Missing, WithoutTooltip });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Default };
