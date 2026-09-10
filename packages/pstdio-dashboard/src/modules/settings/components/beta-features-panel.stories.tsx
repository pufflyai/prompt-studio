import type { Meta, StoryObj } from "@storybook/react";
import { BetaFeaturesContent } from "./beta-features-panel";

const meta = {
  title: "Settings/Beta features",
  component: BetaFeaturesContent,
  args: { onChange: () => undefined, onRetry: () => undefined },
} satisfies Meta<typeof BetaFeaturesContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Off: Story = { args: { enabled: false } };
export const On: Story = { args: { enabled: true } };
export const Loading: Story = { args: { enabled: undefined } };
export const Failure: Story = { args: { enabled: false, error: "Could not save settings. Try again." } };
