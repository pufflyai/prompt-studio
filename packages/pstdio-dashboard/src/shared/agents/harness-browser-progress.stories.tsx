import type { Meta, StoryObj } from "@storybook/react";
import { HarnessBrowserProgress } from "./harness-browser-progress";

const meta: Meta<typeof HarnessBrowserProgress> = {
  title: "Agents/Browser sign-in",
  component: HarnessBrowserProgress,
  args: { name: "Codex", action: "login", onCancel: () => {} },
};
export default meta;
type Story = StoryObj<typeof HarnessBrowserProgress>;
export const Starting: Story = {};
export const DeviceCode: Story = {
  args: { prompt: { type: "browser", url: "https://auth.openai.com/codex/device", code: "TEST-1234" } },
};
export const BrowserLink: Story = { args: { prompt: { type: "browser", url: "https://example.test/login" } } };
export const SigningOut: Story = { args: { action: "logout" } };

export const ProviderChoice: Story = {
  args: {
    question: {
      type: "select",
      title: "Choose a provider",
      initial: "openai",
      options: [
        { id: "openai", label: "OpenAI" },
        { id: "anthropic", label: "Anthropic" },
      ],
    },
    onReply: () => {},
  },
};
export const ApiKey: Story = {
  args: { question: { type: "input", title: "OpenAI API key", secret: true }, onReply: () => {} },
};
