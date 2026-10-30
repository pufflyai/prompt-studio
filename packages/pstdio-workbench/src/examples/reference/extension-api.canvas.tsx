import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createExtensionPreview } from "../onboarding/extension-preview";
import pageExtension, { guidePage } from "../onboarding/extensions/page-extension";
import { OnboardingFrame } from "../onboarding/onboarding-frame";

const meta = {
  title: "pstdio-workbench/Reference/Extension API",
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const RunnableExample: Story = {
  id: "pstdio-workbench-reference-extension-api--runnable-example",
  name: "Runnable example",
  description: "An extension declares native file views, pages, and sidebar navigation items.",
  render: () => <OnboardingFrame createWorkbench={() => createExtensionPreview(pageExtension, guidePage.id)} />,
};
