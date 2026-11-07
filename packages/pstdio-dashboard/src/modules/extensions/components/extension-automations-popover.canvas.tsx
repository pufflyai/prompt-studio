import { Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { WorkbenchExtensionAutomationRecord } from "@pstdio/sdk/api";
import { useState } from "react";
import { ExtensionAutomationsPopover } from "./extension-automations-popover";

const automations: WorkbenchExtensionAutomationRecord[] = [
  {
    id: "example.tool.schedule.daily",
    localId: "daily",
    extensionId: "example.tool",
    extensionInstanceId: "tool-instance",
    title: "Review open work",
    cron: "0 6 * * *",
    commandId: "example.tool.command.review",
    enabled: true,
  },
  {
    id: "example.tool.schedule.weekly",
    localId: "weekly",
    extensionId: "example.tool",
    extensionInstanceId: "tool-instance",
    title: "Prepare the weekly report",
    cron: "0 9 * * 1",
    commandId: "example.tool.command.report",
    enabled: false,
  },
];

const meta: CanvasMeta<typeof ExtensionAutomationsPopover> = {
  title: "Product/Settings/Extensions/Automation popover",
  component: ExtensionAutomationsPopover,
  args: { automations, onToggleAutomation: async () => {} },
  decorators: [
    (Frame) => (
      <Stack padding="md" alignItems="start">
        <Frame />
      </Stack>
    ),
  ],
};
export default meta;
type Story = CanvasFrame<typeof ExtensionAutomationsPopover>;

export const Interactive = () => {
  const [schedules, setSchedules] = useState(automations);
  return (
    <ExtensionAutomationsPopover
      automations={schedules}
      onToggleAutomation={async (automation, enabled) =>
        setSchedules((current) => current.map((entry) => (entry.id === automation.id ? { ...entry, enabled } : entry)))
      }
    />
  );
};

export const Saving: Story = { args: { togglingAutomation: true } };

export const LongNames: Story = {
  args: {
    automations: automations.map((automation) => ({
      ...automation,
      title: `${automation.title} for all active projects and workspaces`,
    })),
  },
};

export const ManyAutomations: Story = {
  args: {
    automations: Array.from({ length: 20 }, (_, index) => ({
      ...automations[index % automations.length],
      id: `example.tool.schedule.${index}`,
      title: `Scheduled task ${index + 1}`,
    })),
  },
};
