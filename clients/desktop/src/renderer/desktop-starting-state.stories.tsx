import type { Meta, StoryObj } from "@storybook/react-vite";
import { DesktopStartupProgress } from "./desktop-starting-state";

const meta = {
  title: "Patterns/Desktop/Startup progress",
  component: DesktopStartupProgress,
  parameters: { layout: "centered" },
  args: { phase: "database" },
} satisfies Meta<typeof DesktopStartupProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PreparingData: Story = {};
export const BackingUpPreviousData: Story = { args: { phase: "retiring" } };
export const BackupTakingLonger: Story = { args: { phase: "retiring", takingLonger: true } };
export const LoadingTools: Story = { args: { phase: "extensions" } };
export const TakingLonger: Story = { args: { phase: "database", takingLonger: true } };
