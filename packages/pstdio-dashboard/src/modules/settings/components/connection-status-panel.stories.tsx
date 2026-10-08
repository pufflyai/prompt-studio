import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ConnectionStatusContent } from "./connection-status-panel";

const meta = {
  title: "Settings/Connection status",
  component: ConnectionStatusContent,
  args: { enabled: false, onChange: () => undefined, onDismissError: () => undefined },
} satisfies Meta<typeof ConnectionStatusContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Off: Story = {};
export const On: Story = { args: { enabled: true } };
export const SaveFailure: Story = { args: { error: "Could not change connection status display." } };

const InteractiveConnectionStatus = () => {
  const [enabled, setEnabled] = useState(false);
  return <ConnectionStatusContent enabled={enabled} onChange={setEnabled} onDismissError={() => undefined} />;
};
export const Toggle: Story = { render: () => <InteractiveConnectionStatus /> };
