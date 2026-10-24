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
export const CopyingDatabase: Story = { args: { phase: "upgrade_copying" } };
export const ReadingDatabase: Story = { args: { phase: "upgrade_exporting" } };
export const MigratingDatabase: Story = { args: { phase: "upgrade_importing" } };
export const MigrationTakingLonger: Story = { args: { phase: "upgrade_importing", takingLonger: true } };
export const LoadingTools: Story = { args: { phase: "extensions" } };
export const TakingLonger: Story = { args: { phase: "database", takingLonger: true } };
