import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../workbench-story";
import { createGenericCollectionRendererModule } from "./module";

const meta = {
  title: "pstdio-workbench/Reference/Core API/Extension adapter",
  description:
    "The host adapter turns checked extension metadata into native renderer registrations. Extension authors use @pstdio/sdk/extensions instead of this API.",
  fullscreen: true,
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant<typeof meta>;
const workbench = createWorkbench();
workbench.registerModule(createGenericCollectionRendererModule());
export const ExtensionOwnedRules: Story = {
  id: "pstdio-workbench-reference-core-api-extension-adapter--extension-owned-rules",
  render: () => <WorkbenchStory workbench={workbench} />,
};
