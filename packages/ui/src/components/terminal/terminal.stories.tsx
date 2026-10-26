import { Button, Input, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
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

const DeferredFocusFixture = () => {
  const [bridge] = useState(() => createScriptedTerminalBridge({ initial: [{ data: "Focus fixture ready\r\n" }] }));
  const [generation, setGeneration] = useState(0);
  const next = useRef<HTMLInputElement | null>(null);
  // Parent effects run after Terminal requests focus and before its deferred construction.
  useEffect(() => next.current?.focus(), []);
  return (
    <Stack>
      <Input ref={next} aria-label="Next control" />
      <Button onClick={() => setGeneration(generation + 1)}>Open another terminal</Button>
      <TerminalFrame>
        <Terminal key={generation} bridge={bridge} />
      </TerminalFrame>
    </Stack>
  );
};

export const DeferredFocusRespectsNewChoice: Story = {
  tags: ["!manifest", "terminal-deferred-focus"],
  render: () => <DeferredFocusFixture />,
};

const PopupRestoreFocusFixture = () => {
  const [bridge] = useState(() => createScriptedTerminalBridge({ initial: [{ data: "Opened from a menu\r\n" }] }));
  const [open, setOpen] = useState(false);
  const [menuClosed, setMenuClosed] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  // The selected action mounts the terminal while its menu item still has focus. The closing menu then
  // returns focus to its trigger and unmounts, as a menu does after its exit.
  useEffect(() => {
    if (!open) return;
    trigger.current?.focus();
    setMenuClosed(true);
  }, [open]);
  return (
    <Stack>
      <Button ref={trigger} aria-haspopup="menu" aria-controls="terminal-actions">
        Row actions
      </Button>
      {menuClosed ? null : (
        <div id="terminal-actions" role="menu" aria-label="Row actions">
          <Button role="menuitem" autoFocus onClick={() => setOpen(true)}>
            Open terminal
          </Button>
        </div>
      )}
      {open ? (
        <TerminalFrame>
          <Terminal bridge={bridge} />
        </TerminalFrame>
      ) : null}
    </Stack>
  );
};

export const DeferredFocusIgnoresPopupRestore: Story = {
  tags: ["!manifest", "terminal-deferred-focus"],
  render: () => <PopupRestoreFocusFixture />,
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

// Agent CLIs print OSC 8 hyperlinks, where the visible label differs from the target URL.
const osc8Link = (label: string, url: string) => `\x1b]8;;${url}\x07${label}\x1b]8;;\x07`;

const webLinks = [
  { label: "https://example.com/terminal?from=preview", url: "https://example.com/terminal?from=preview" },
  { label: "http://localhost:5173/", url: "http://localhost:5173/" },
  { label: "Open the terminal guide", url: "https://example.com/guide", data: osc8Link },
];

export const WebLinks: Story = {
  render: () => (
    <TerminalStory
      bridgeFactory={() =>
        createScriptedTerminalBridge({
          initial: [
            { data: "Ctrl-click or Cmd-click a link to open it.\r\n" },
            ...webLinks.map((link) => ({ data: `${link.data?.(link.label, link.url) ?? link.url}\r\n` })),
          ],
        })
      }
    />
  ),
  play: async ({ canvasElement }) => {
    // Keep the browser API boundary local so the story never opens external pages.
    const open = spyOn(window, "open").mockReturnValue(null);
    try {
      for (const link of webLinks) {
        const row = await waitFor(() => {
          const element = Array.from(canvasElement.querySelectorAll<HTMLElement>(".xterm-rows > div")).find(
            (candidate) => candidate.textContent?.trim() === link.label,
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
          expect(open).toHaveBeenLastCalledWith(link.url, "_blank", "noopener,noreferrer");
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
