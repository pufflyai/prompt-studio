import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createViewsWorkbench } from "../onboarding/core/views";
import { OnboardingFrame } from "../onboarding/onboarding-frame";

const meta = {
  title: "pstdio-workbench/Reference/Core API",
} satisfies CanvasMeta;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const RunnableExample: Story = {
  id: "pstdio-workbench-reference-core-api--runnable-example",
  name: "Runnable example",
  description: "A host registers React Views, then places them in workbench regions.",
  render: () => <OnboardingFrame createWorkbench={createViewsWorkbench} />,
};
