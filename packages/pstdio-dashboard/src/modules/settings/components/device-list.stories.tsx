import type { Meta, StoryObj } from "@storybook/react";
import { DeviceList } from "./device-list";

const meta = {
  title: "Cloud/Devices",
  component: DeviceList,
  parameters: { layout: "padded" },
  args: {
    onRename: () => {},
    onRemove: () => {},
    online: true,
  },
} satisfies Meta<typeof DeviceList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = { args: { devices: [] } };
export const SeveralDevices: Story = {
  args: {
    devices: [
      {
        id: "mac",
        name: "Work Mac",
        platform: "darwin",
        current: true,
        createdAt: "2026-10-01T10:00:00Z",
        lastSeenAt: "2026-10-20T10:00:00Z",
      },
      {
        id: "linux",
        name: "Home laptop",
        platform: "linux",
        current: false,
        createdAt: "2026-10-01T10:00:00Z",
        lastSeenAt: "2026-10-19T10:00:00Z",
      },
      {
        id: "windows",
        name: "Desktop",
        platform: "win32",
        current: false,
        createdAt: "2026-10-01T10:00:00Z",
        lastSeenAt: "2026-10-18T10:00:00Z",
      },
    ],
  },
};
export const ConnectionUnavailable: Story = { args: { ...SeveralDevices.args, online: false } };
