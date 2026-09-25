import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, spyOn, waitFor } from "storybook/test";
import { createScriptedTerminalBridge, type ScriptedTerminalStep } from "./scripted-bridge";
import { Terminal } from "./terminal";
import type { TerminalBridge } from "./types";

const meta: Meta<typeof Terminal> = {
  title: "Components/Terminal",
  component: Terminal,
  parameters: { layout: "centered" },
};

export default meta;

type Story = StoryObj<typeof Terminal>;

const TerminalFrame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: "min(720px, 90vw)", height: "320px" }}>{children}</div>
);

const interactiveSteps: ScriptedTerminalStep[] = [
  { data: "\x1b[1;34mWelcome to @pstdio/ui/terminal\x1b[0m\r\n" },
  { data: "Type any text and it will be echoed back.\r\n\r\n" },
  { data: "$ ", delayMs: 0 },
];

const echoPromptOnEnter = (input: string): ScriptedTerminalStep[] => {
  if (input === "\r") {
    return [{ data: "\r\n$ " }];
  }
  return [{ data: input }];
};

const TerminalStory = ({ bridgeFactory, theme }: { bridgeFactory: () => TerminalBridge; theme?: "dark" | "light" }) => {
  const [bridge] = useState(bridgeFactory);
  return (
    <TerminalFrame>
      <Terminal bridge={bridge} theme={theme} />
    </TerminalFrame>
  );
};

export const Default: Story = {
  render: () => (
    <TerminalStory
      bridgeFactory={() =>
        createScriptedTerminalBridge({
          initial: interactiveSteps,
          onInput: echoPromptOnEnter,
        })
      }
    />
  ),
};

const webLinks = ["https://example.com/terminal?from=preview", "http://localhost:5173/"];

export const WebLinks: Story = {
  render: () => (
    <TerminalStory
      bridgeFactory={() =>
        createScriptedTerminalBridge({
          initial: [
            { data: "Ctrl-click or Cmd-click a URL to open it.\r\n" },
            ...webLinks.map((url) => ({ data: `${url}\r\n` })),
          ],
        })
      }
    />
  ),
  play: async ({ canvasElement }) => {
    // Keep the browser API boundary local so the story never opens external pages.
    const open = spyOn(window, "open").mockReturnValue(null);
    try {
      for (const url of webLinks) {
        const row = await waitFor(() => {
          const element = Array.from(canvasElement.querySelectorAll<HTMLElement>(".xterm-rows > div")).find(
            (candidate) => candidate.textContent?.trim() === url,
          );
          expect(element).toBeVisible();
          return element!;
        });
        const screen = canvasElement.querySelector<HTMLElement>(".xterm-screen")!;
        const bounds = row.getBoundingClientRect();
        const position = { clientX: bounds.left + 30, clientY: bounds.top + bounds.height / 2 };
        await fireEvent.mouseMove(screen, position);
        await waitFor(() => expect(screen).toHaveClass("xterm-cursor-pointer"));
        open.mockClear();
        await fireEvent.mouseDown(screen, { ...position, button: 0 });
        await fireEvent.mouseUp(screen, { ...position, button: 0 });
        expect(open).not.toHaveBeenCalled();
        for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
          await fireEvent.mouseDown(screen, { ...position, ...modifier, button: 0 });
          await fireEvent.mouseUp(screen, { ...position, ...modifier, button: 0 });
          expect(open).toHaveBeenLastCalledWith(url, "_blank", "noopener,noreferrer");
        }
        expect(open).toHaveBeenCalledTimes(2);
      }
    } finally {
      open.mockRestore();
    }
  },
};

export const LightTheme: Story = {
  render: () => (
    <TerminalStory
      bridgeFactory={() =>
        createScriptedTerminalBridge({
          initial: interactiveSteps,
          onInput: echoPromptOnEnter,
        })
      }
      theme="light"
    />
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <TerminalStory
      bridgeFactory={() =>
        createScriptedTerminalBridge({
          initial: interactiveSteps,
          onInput: echoPromptOnEnter,
        })
      }
      theme="dark"
    />
  ),
};

const scriptedRunSteps: ScriptedTerminalStep[] = [
  { data: "$ bun run build\r\n" },
  { data: "\x1b[2mResolving workspace...\x1b[0m\r\n", delayMs: 250 },
  { data: "\x1b[36m• packages/ui\x1b[0m\r\n", delayMs: 200 },
  { data: "  building...\r\n", delayMs: 200 },
  { data: "\x1b[32m✓ packages/ui\x1b[0m built in 1.2s\r\n", delayMs: 400 },
  { data: "\x1b[1mDone.\x1b[0m\r\n", delayMs: 200 },
  { exit: { code: 0 } },
];

export const ScriptedOutput: Story = {
  render: () => (
    <TerminalStory
      bridgeFactory={() =>
        createScriptedTerminalBridge({
          initial: scriptedRunSteps,
        })
      }
      theme="dark"
    />
  ),
};

// Emits more rows than the frame can show so the scrollback scrollbar renders:
// it should be the slim app-styled bar, not xterm's wide native gutter.
const scrollbackSteps: ScriptedTerminalStep[] = Array.from({ length: 60 }, (_, index) => ({
  data: `\x1b[2m${String(index + 1).padStart(3, "0")}\x1b[0m log line ${index + 1}\r\n`,
}));

export const Scrollback: Story = {
  render: () => (
    <TerminalStory bridgeFactory={() => createScriptedTerminalBridge({ initial: scrollbackSteps })} theme="dark" />
  ),
};
