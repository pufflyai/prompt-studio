import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchResourceSearch } from "./resource-search";

const workbench = createWorkbench();
const meta = {
  title: "pstdio-workbench/Components/Resource search",
  component: WorkbenchResourceSearch,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
  args: {
    workbench,
    onClose: () => {},
    request: {
      label: "Switch session",
      placeholder: "Search sessions",
      list: () =>
        Array.from({ length: 200 }, (_, index) => ({
          resource: {
            type: "session",
            id: String(index),
            label: `Session ${String(index).padStart(3, "0")}`,
            icon: "MessageCircle",
          },
          activate() {},
        })),
    },
  },
} satisfies CanvasMeta<typeof WorkbenchResourceSearch>;
export default meta;
export const FullHistory: CanvasVariant<typeof meta> = {
  id: "pstdio-workbench-components-resource-search--full-history",
};
export const Empty: CanvasVariant<typeof meta> = {
  id: "pstdio-workbench-components-resource-search--empty",
  args: { request: { label: "Switch session", placeholder: "Search sessions", list: () => [] } },
};
export const StatusIndicators: CanvasVariant<typeof meta> = {
  id: "pstdio-workbench-components-resource-search--status-indicators",
  args: {
    request: {
      label: "Switch session",
      placeholder: "Search sessions",
      list: () =>
        [
          { label: "Running", icon: "LoaderCircle", color: "fg.info" },
          { label: "Waiting for input", icon: "CircleDot", color: "fg.warning" },
          { label: "Queued", icon: "ClockAlert", color: "fg.info" },
          { label: "Completed", icon: "CircleCheck", color: "fg.success" },
          { label: "Failed", icon: "CircleAlert", color: "fg.error" },
          { label: "Cancelled", icon: "CircleStop", color: "fg.warning" },
          { label: "Disconnected", icon: "CirclePause", color: "fg.warning" },
          { label: "Unknown", icon: "CircleDashed", color: "fg.muted" },
        ].map(({ label, icon, color }) => ({
          resource: { type: "session", id: label, label: `${label} session`, icon: "MessageCircle" },
          indicator: { icon, color, label: `Session status: ${label}` },
          activate() {},
        })),
    },
  },
};
const ownedWorkbench = createWorkbench();
ownedWorkbench.resources.registerKind({ kind: "drawing", extensionId: "first", label: "First", icon: "File" });
ownedWorkbench.resources.registerKind({ kind: "drawing", extensionId: "second", label: "Second", icon: "Folder" });
export const OwnerIcons: CanvasVariant<typeof meta> = {
  id: "pstdio-workbench-components-resource-search--owner-icons",
  args: {
    workbench: ownedWorkbench,
    request: {
      label: "Owner icons",
      placeholder: "Search drawings",
      list: () => [
        { resource: { type: "drawing", id: "one", extensionId: "first", label: "First drawing" }, activate() {} },
        { resource: { type: "drawing", id: "one", extensionId: "second", label: "Second drawing" }, activate() {} },
      ],
    },
  },
};
