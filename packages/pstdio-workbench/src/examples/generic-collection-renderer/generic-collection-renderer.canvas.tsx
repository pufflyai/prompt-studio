import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../workbench-story";
import { createGenericCollectionRendererModule } from "./module";
import source from "./module.tsx?raw";

const meta = {
  title: "pstdio-workbench/Reference/Core API/Extension adapter",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The host adapter turns checked extension metadata into native renderer registrations. Extension authors use @pstdio/sdk/extensions instead of this API.",
      },
    },
  },
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant<typeof meta>;
const workbench = createWorkbench();
workbench.registerModule(createGenericCollectionRendererModule());
export const ExtensionOwnedRules: Story = {
  id: "pstdio-workbench-reference-core-api-extension-adapter--extension-owned-rules",
  parameters: {
    docs: { source: { code: source, language: "tsx", type: "code" } },
  },
  render: () => <WorkbenchStory workbench={workbench} />,
};
