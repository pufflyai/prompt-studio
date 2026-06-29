import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
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
  { data: "\x1b[1;34mWelcome to @pstdio/ui-terminal\x1b[0m\r\n" },
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
  { data: "\x1b[36m• packages/ui-terminal\x1b[0m\r\n", delayMs: 200 },
  { data: "  building...\r\n", delayMs: 200 },
  { data: "\x1b[32m✓ packages/ui-terminal\x1b[0m built in 1.2s\r\n", delayMs: 400 },
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
