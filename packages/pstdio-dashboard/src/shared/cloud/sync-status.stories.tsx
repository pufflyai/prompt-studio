import type { Meta, StoryObj } from "@storybook/react";
import { SyncStatus } from "./sync-status";

const meta = { title: "Cloud/ProjectSync", component: SyncStatus, parameters: { layout: "centered" } } satisfies Meta<
  typeof SyncStatus
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SavedLocally: Story = { args: { state: "saved-locally" } };
export const WaitingToSync: Story = { args: { state: "waiting-to-sync" } };
export const Synced: Story = { args: { state: "synced" } };
export const Offline: Story = { args: { state: "offline" } };
export const FirstDownloadIncomplete: Story = { args: { state: "first-download-incomplete" } };
export const NeedsAttention: Story = { args: { state: "needs-attention" } };
