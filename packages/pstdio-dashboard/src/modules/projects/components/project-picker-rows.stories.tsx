import { Box } from "@chakra-ui/react";
import { standardResourceIcons } from "@pstdio/workbench";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { createDashboardResource } from "@/shared/app/resources";
import type { DashboardProject } from "../data/project-data";
import { ProjectPickerRows, type ProjectPickerRowsProps } from "./project-picker-widget";

const project = (id: string, name: string, folderPath: string | null): DashboardProject => ({
  id,
  name,
  folderPath,
  createdAt: "",
  updatedAt: "",
  resource: createDashboardResource("project", id, name, standardResourceIcons.project, id),
});
const projects = [
  project("prompt-studio", "Prompt Studio", null),
  project("granite", "Granite", null),
  project("docufin", "Docufin", "~/Projects/docufin"),
  project("scratchpad", "Scratchpad", "~/Documents/scratchpad"),
];

const signedOut: ProjectPickerRowsProps["cloudState"] = () => ({ signedIn: false, cloud: false });

const meta = {
  title: "Projects/Project picker rows",
  component: ProjectPickerRows,
  decorators: [
    (Story) => (
      <Box w="md">
        <Story />
      </Box>
    ),
  ],
  args: {
    projects,
    selectedProjectId: "prompt-studio",
    searchTerm: "",
    onSelectProject: fn(),
    cloudState: signedOut,
  },
} satisfies Meta<typeof ProjectPickerRows>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Right after signing in on a new device, cloud projects download without a folder. */
export const NewDeviceDownloading: Story = {
  args: {
    cloudState: (id) =>
      id === "scratchpad"
        ? { signedIn: true, cloud: false }
        : { signedIn: true, cloud: true, sync: { state: "first-download-incomplete", offlineReady: false } },
  },
};

/** The first download is done, and newer changes are still on their way. */
export const WaitingToDownload: Story = {
  args: {
    cloudState: (id) =>
      id === "scratchpad"
        ? { signedIn: true, cloud: false }
        : { signedIn: true, cloud: true, sync: { state: "waiting-to-sync", offlineReady: false } },
  },
};

/** The data is down. Docufin already got its folder. */
export const ReadyWithoutFolder: Story = {
  args: {
    cloudState: (id) =>
      id === "scratchpad"
        ? { signedIn: true, cloud: false }
        : { signedIn: true, cloud: true, sync: { state: "synced", offlineReady: true } },
  },
};

export const SignedOut: Story = {};
