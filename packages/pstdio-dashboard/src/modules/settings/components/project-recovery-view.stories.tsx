import type { Meta, StoryObj } from "@storybook/react";
import { ProjectRecoveryView } from "./project-recovery-view";

const meta = {
  title: "ProjectSettings/Recovery",
  component: ProjectRecoveryView,
  args: {
    extensionNames: { "pstdio-planner": "Planner", "pstdio-notes": "Notes" },
    points: [1, 12, 24].map((hours) => ({
      hours: hours as 1 | 12 | 24,
      capturedAt: new Date(Date.UTC(2026, 9, 22, 12 - hours)).toISOString(),
      extensions: ["pstdio-planner", "pstdio-notes"],
    })),
    onRefresh: () => {},
    onRestore: async () => {},
  },
} satisfies Meta<typeof ProjectRecoveryView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { points: [] } };
export const Loading: Story = { args: { points: [], loading: true } };
export const LoadError: Story = { args: { points: [], error: "Unable to read recovery points. Try refreshing." } };
export const LowDiskSpace: Story = { args: { points: [meta.args.points[1]!] } };
export const RestoreError: Story = {
  args: {
    onRestore: async () => {
      throw new Error("This recovery point changed or is no longer available. Refresh the list.");
    },
  },
};
