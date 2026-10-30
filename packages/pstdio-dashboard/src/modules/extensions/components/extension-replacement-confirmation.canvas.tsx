import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ExtensionReplacementConfirmation } from "./extension-replacement-confirmation";

const meta = {
  title: "Settings/Extension Replacement Confirmation",
  component: ExtensionReplacementConfirmation,
} satisfies CanvasMeta<typeof ExtensionReplacementConfirmation>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const ExistingExtension: Story = {
  id: "settings-extension-replacement-confirmation--existing-extension",
  args: { replacement: { name: "My Tool", retry: async () => {} }, onClose: () => {} },
};
