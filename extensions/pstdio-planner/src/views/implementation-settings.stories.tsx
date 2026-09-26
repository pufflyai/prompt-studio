import type { Meta, StoryObj } from "@storybook/react";
import { ImplementationSettingsFields } from "./implementation-settings-panel";

const meta = {
  title: "Planner/Implementation settings",
  component: ImplementationSettingsFields,
  args: {
    adversarialReview: true,
    openPr: true,
    t: (key, fallback) => fallback ?? key,
    onChange: () => {},
    targets: { selected: "origin/main", branches: ["origin/main", "origin/release"] },
  },
} satisfies Meta<typeof ImplementationSettingsFields>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithoutGit: Story = { args: { targets: null } };
export const MissingSavedBranch: Story = {
  args: { targets: { selected: "origin/release", branches: ["origin/main"] } },
};
