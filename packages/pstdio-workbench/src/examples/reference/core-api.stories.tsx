import type { Meta, StoryObj } from "@storybook/react";
import { createViewsWorkbench } from "../onboarding/core/views";
import source from "../onboarding/core/views.tsx?raw";
import { OnboardingFrame } from "../onboarding/onboarding-frame";

const meta = {
  title: "pstdio-workbench/Reference/Core API",
  tags: ["!dev"],
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const RunnableExample: Story = {
  name: "Runnable example",
  parameters: {
    docs: {
      description: { story: "A host registers React Views, then places them in workbench regions." },
      source: { code: source, language: "tsx", type: "code" },
    },
  },
  render: () => <OnboardingFrame createWorkbench={createViewsWorkbench} />,
};
