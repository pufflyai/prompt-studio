import type { Meta, StoryObj } from "@storybook/react";
import { createExtensionPreview } from "../onboarding/extension-preview";
import treePageExtension, { guidePage } from "../onboarding/extensions/tree-page-extension";
import source from "../onboarding/extensions/tree-page-extension.ts?raw";
import { OnboardingFrame } from "../onboarding/onboarding-frame";

const meta = {
  title: "pstdio-workbench/Reference/Extension API",
  tags: ["!dev"],
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const RunnableExample: Story = {
  name: "Runnable example",
  parameters: {
    docs: {
      description: { story: "An extension declares a native tree View, a page, and its navigation item." },
      source: { code: source, language: "tsx", type: "code" },
    },
  },
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(treePageExtension, guidePage.id)} />,
};
