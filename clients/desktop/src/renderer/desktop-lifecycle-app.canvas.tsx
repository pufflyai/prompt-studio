import { Flex } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { DesktopLifecycleView } from "./desktop-lifecycle-app";

const actions = {
  copyDiagnostics: async () => {},
  openLogs: async () => {},
  quitApp: async () => {},
  revealInFinder: async () => {},
  retryRuntime: async () => {},
};
const meta = {
  title: "Patterns/Desktop/Lifecycle",
  component: DesktopLifecycleView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Flex>
        <Story />
      </Flex>
    ),
  ],
  args: { actions },
} satisfies CanvasMeta<typeof DesktopLifecycleView>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const StartingDiscovery: Story = {
  id: "patterns-desktop-lifecycle--starting-discovery",
  args: { state: { kind: "starting", phase: "discovery" } },
};
export const StartingRuntime: Story = {
  id: "patterns-desktop-lifecycle--starting-runtime",
  args: { state: { kind: "starting", phase: "spawning" } },
};
export const BackingUpPreviousData: Story = {
  id: "patterns-desktop-lifecycle--backing-up-previous-data",
  args: { state: { kind: "starting", phase: "retiring" } },
};
export const WaitingForWorkbench: Story = {
  id: "patterns-desktop-lifecycle--waiting-for-workbench",
  args: { state: { kind: "starting", phase: "readiness" } },
};
export const Workbench: Story = {
  id: "patterns-desktop-lifecycle--workbench",
  tags: ["!manifest"],
  args: {
    state: {
      kind: "workbench",
      runtime: { instanceId: "runtime-one", origin: "http://127.0.0.1:43127", ownerType: "desktop" },
    },
  },
};
export const ActiveWorkInWorkbench: Story = {
  id: "patterns-desktop-lifecycle--active-work-in-workbench",
  tags: ["!manifest"],
  args: {
    state: {
      kind: "confirming_active_work",
      runtime: { instanceId: "runtime-one", origin: "http://127.0.0.1:43127", ownerType: "desktop" },
      activity: { sessions: [{ id: "session-one", label: "PS-217 implementation" }], terminals: [], jobs: [] },
    },
  },
};
export const Recovery: Story = {
  id: "patterns-desktop-lifecycle--recovery",
  args: {
    state: {
      kind: "recovery",
      error: {
        code: "pglite_recovery_failure",
        message: "Prompt Studio could not open its database safely.",
        actions: ["retry", "open_logs", "copy_diagnostics", "quit"],
      },
    },
  },
};
export const Closing: Story = {
  id: "patterns-desktop-lifecycle--closing",
  args: { state: { kind: "closing" } },
};
export const LongRecoveryDetails: Story = {
  id: "patterns-desktop-lifecycle--long-recovery-details",
  args: {
    state: {
      kind: "recovery",
      error: {
        code: "unexpected_exit",
        message: Array.from(
          { length: 80 },
          (_, index) =>
            `Startup log ${index}: ENOENT: /project/.pstdio/extensions/example/src/workbench/src/views/notebook.tsx`,
        ).join("\n"),
        actions: ["retry", "open_logs", "copy_diagnostics", "quit"],
      },
    },
  },
};
