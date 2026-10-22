import { Flex } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { DesktopLifecycleView } from "./desktop-lifecycle-app";

const actions = {
  copyDiagnostics: async () => {},
  openLogs: async () => {},
  quitApp: async () => {},
  revealInFinder: async () => {},
  retryRuntime: async () => {},
};

const expectWindowWidth = async (canvasElement: HTMLElement) => {
  const main = within(canvasElement).getByRole("main");
  const hostWidth = main.parentElement!.getBoundingClientRect().width;
  await expect(main.getBoundingClientRect().width).toBe(hostWidth);
  await expect(main.querySelector("[data-window-title-bar]")!.getBoundingClientRect().width).toBe(hostWidth);
  const status = within(canvasElement).queryByRole("status");
  if (status) {
    const bounds = status.getBoundingClientRect();
    const mainBounds = main.getBoundingClientRect();
    await expect(Math.abs(bounds.x + bounds.width / 2 - mainBounds.x - hostWidth / 2)).toBeLessThan(1);
  }
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
  play: async ({ canvasElement }) => expectWindowWidth(canvasElement),
  args: { actions },
} satisfies Meta<typeof DesktopLifecycleView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StartingDiscovery: Story = {
  args: { state: { kind: "starting", phase: "discovery" } },
};

export const StartingRuntime: Story = {
  args: { state: { kind: "starting", phase: "spawning" } },
};

export const WaitingForWorkbench: Story = {
  args: { state: { kind: "starting", phase: "readiness" } },
};

const expectNoLifecycleSurface = async (canvasElement: HTMLElement) => {
  await expect(within(canvasElement).queryByRole("main")).not.toBeInTheDocument();
  await expect(canvasElement.querySelector("[data-window-title-bar]")).not.toBeInTheDocument();
};

export const Workbench: Story = {
  tags: ["!manifest"],
  args: {
    state: {
      kind: "workbench",
      runtime: { instanceId: "runtime-one", origin: "http://127.0.0.1:43127", ownerType: "desktop" },
    },
  },
  play: async ({ canvasElement }) => expectNoLifecycleSurface(canvasElement),
};

export const ActiveWorkInWorkbench: Story = {
  tags: ["!manifest"],
  args: {
    state: {
      kind: "confirming_active_work",
      runtime: { instanceId: "runtime-one", origin: "http://127.0.0.1:43127", ownerType: "desktop" },
      activity: { sessions: [{ id: "session-one", label: "PS-217 implementation" }], terminals: [], jobs: [] },
    },
  },
  play: async ({ canvasElement }) => expectNoLifecycleSurface(canvasElement),
};

export const Recovery: Story = {
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
  args: { state: { kind: "closing" } },
};

export const LongRecoveryDetails: Story = {
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
  play: async ({ canvasElement }) => {
    await expectWindowWidth(canvasElement);
    const canvas = within(canvasElement);
    const main = canvas.getByRole("main");
    const window = canvasElement.ownerDocument.defaultView!;
    await expect(main.getBoundingClientRect().height).toBeLessThanOrEqual(window.innerHeight);
    const viewport = main.querySelector<HTMLElement>('[data-scope="scroll-area"][data-part="viewport"]')!;
    await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    viewport.scrollTop = viewport.scrollHeight;
    await expect(viewport.scrollTop).toBeGreaterThan(0);
    for (const name of ["Retry", "Open logs", "Copy diagnostics", "Quit"]) {
      const button = canvas.getByRole("button", { name });
      await expect(button).toBeVisible();
      const bounds = button.getBoundingClientRect();
      await expect(bounds.top).toBeGreaterThanOrEqual(0);
      await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
    }
  },
};
