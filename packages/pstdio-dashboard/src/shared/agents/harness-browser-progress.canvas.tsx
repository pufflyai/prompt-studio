import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { HarnessBrowserProgress } from "./harness-browser-progress";

const meta: CanvasMeta<typeof HarnessBrowserProgress> = {
  title: "Agents/Browser sign-in",
  component: HarnessBrowserProgress,
  args: { name: "Codex", action: "login", onCancel: () => {} },
};
export default meta;
type Story = CanvasFrame<typeof HarnessBrowserProgress>;
export const Starting: Story = {
  id: "agents-browser-sign-in--starting",
};
export const DeviceCode: Story = {
  id: "agents-browser-sign-in--device-code",
  args: { prompt: { type: "browser", url: "https://auth.openai.com/codex/device", code: "TEST-1234" } },
};
export const BrowserLink: Story = {
  id: "agents-browser-sign-in--browser-link",
  args: { prompt: { type: "browser", url: "https://example.test/login" } },
};
export const SigningOut: Story = {
  id: "agents-browser-sign-in--signing-out",
  args: { action: "logout" },
};
export const ProviderChoice: Story = {
  id: "agents-browser-sign-in--provider-choice",
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
  id: "agents-browser-sign-in--api-key",
  args: { question: { type: "input", title: "OpenAI API key", secret: true }, onReply: () => {} },
};
