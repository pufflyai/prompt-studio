import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createExtensionPreview } from "../onboarding/extension-preview";
import pageExtension, { guidePage } from "../onboarding/extensions/page-extension";
import source from "../onboarding/extensions/page-extension.ts?raw";
import { OnboardingFrame } from "../onboarding/onboarding-frame";

const meta = {
  title: "pstdio-workbench/Reference/Extension API",
  tags: ["!dev"],
  parameters: { layout: "padded" },
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const RunnableExample: Story = {
  id: "pstdio-workbench-reference-extension-api--runnable-example",
  name: "Runnable example",
  parameters: {
    docs: {
      description: { story: "An extension declares native file views, pages, and sidebar navigation items." },
      source: { code: source, language: "tsx", type: "code" },
    },
  },
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(pageExtension, guidePage.id)} />,
};
