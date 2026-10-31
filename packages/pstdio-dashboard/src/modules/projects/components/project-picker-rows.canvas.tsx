import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { standardResourceIcons } from "@pstdio/workbench";
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
    onSelectProject: () => {},
    cloudState: signedOut,
  },
} satisfies CanvasMeta<typeof ProjectPickerRows>;
export default meta;
type Story = CanvasFrame<typeof meta>;
/** Right after signing in on a new device, cloud projects download without a folder. */
export const NotOnThisDeviceYet: Story = {
  id: "projects-project-picker-rows--not-on-this-device-yet",
  args: {
    cloudState: (id) =>
      id === "scratchpad"
        ? { signedIn: true, cloud: false }
        : { signedIn: true, cloud: true, sync: { state: "first-download-incomplete", offlineReady: false } },
  },
};
/** The first download is done, and newer changes are still on their way. */
export const WaitingToDownload: Story = {
  id: "projects-project-picker-rows--waiting-to-download",
  args: {
    cloudState: (id) =>
      id === "scratchpad"
        ? { signedIn: true, cloud: false }
        : { signedIn: true, cloud: true, sync: { state: "waiting-to-sync", offlineReady: false } },
  },
};
/** The data is down. Docufin already got its folder. */
export const ReadyWithoutFolder: Story = {
  id: "projects-project-picker-rows--ready-without-folder",
  args: {
    cloudState: (id) =>
      id === "scratchpad"
        ? { signedIn: true, cloud: false }
        : { signedIn: true, cloud: true, sync: { state: "synced", offlineReady: true } },
  },
};
/** A download that cannot finish without help says so instead of claiming to be ready. */
export const NeedsAttention: Story = {
  id: "projects-project-picker-rows--needs-attention",
  args: {
    cloudState: (id) =>
      id === "scratchpad"
        ? { signedIn: true, cloud: false }
        : { signedIn: true, cloud: true, sync: { state: "needs-attention", offlineReady: false } },
  },
};
export const SignedOut: Story = {
  id: "projects-project-picker-rows--signed-out",
};
