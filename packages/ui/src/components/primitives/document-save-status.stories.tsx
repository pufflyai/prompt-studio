import type { Meta, StoryObj } from "@storybook/react";
import { DocumentSaveStatus } from "./document-save-status";

const meta = { title: "Primitives/DocumentSaveStatus", component: DocumentSaveStatus } satisfies Meta<
  typeof DocumentSaveStatus
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SavedLocally: Story = { args: { pending: false, connected: true } };
export const Saving: Story = { args: { pending: true, connected: true } };
export const UnsavedWhileReconnecting: Story = { args: { pending: true, connected: false } };
export const SavedWhileReconnecting: Story = { args: { pending: false, connected: false } };
