import type { Meta, StoryObj } from "@storybook/react";
import { MissingResourceBadge, ResourceBadge } from "@/components/primitives/resource-badge";

const meta: Meta<typeof ResourceBadge> = {
  title: "Components/Data Display/Resource Badge",
  component: ResourceBadge,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof ResourceBadge>;

export const Default: Story = {
  args: {
    fileName: "workspace/analysis/report.md",
    tone: "neutral",
    size: "md",
  },
};

export const Missing: Story = {
  render: () => <MissingResourceBadge referenceId="missing/resource.md" />,
};
