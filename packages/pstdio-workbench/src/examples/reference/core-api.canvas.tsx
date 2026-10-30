import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createViewsWorkbench } from "../onboarding/core/views";
import source from "../onboarding/core/views.tsx?raw";
import { OnboardingFrame } from "../onboarding/onboarding-frame";

const meta = {
  title: "pstdio-workbench/Reference/Core API",
  tags: ["!dev"],
  parameters: { layout: "padded" },
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const RunnableExample: Story = {
  id: "pstdio-workbench-reference-core-api--runnable-example",
  name: "Runnable example",
  parameters: {
    docs: {
      description: { story: "A host registers React Views, then places them in workbench regions." },
      source: { code: source, language: "tsx", type: "code" },
    },
  },
  render: () => <OnboardingFrame createWorkbench={createViewsWorkbench} />,
};
