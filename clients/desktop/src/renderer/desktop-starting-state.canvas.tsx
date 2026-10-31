import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { DesktopStartupProgress } from "./desktop-starting-state";

const meta = {
  title: "Patterns/Desktop/Startup progress",
  component: DesktopStartupProgress,
  args: { phase: "database" },
} satisfies CanvasMeta<typeof DesktopStartupProgress>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const PreparingData: Story = {
  id: "patterns-desktop-startup-progress--preparing-data",
};
export const BackingUpPreviousData: Story = {
  id: "patterns-desktop-startup-progress--backing-up-previous-data",
  args: { phase: "retiring" },
};
export const BackupTakingLonger: Story = {
  id: "patterns-desktop-startup-progress--backup-taking-longer",
  args: { phase: "retiring", takingLonger: true },
};
export const LoadingTools: Story = {
  id: "patterns-desktop-startup-progress--loading-tools",
  args: { phase: "extensions" },
};
export const TakingLonger: Story = {
  id: "patterns-desktop-startup-progress--taking-longer",
  args: { phase: "database", takingLonger: true },
};
