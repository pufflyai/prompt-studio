import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ExtensionIcon } from "./extension-icon";

export default {
  title: "Extensions/Icon",
  component: ExtensionIcon,
  args: { size: "md" },
} satisfies CanvasMeta<typeof ExtensionIcon>;

type Frame = CanvasFrame<typeof ExtensionIcon>;

export const Default: Frame = {
  id: "extensions-icon--default",
  description: "Extensions without a declared icon use Tool Case.",
};

export const UICanvas: Frame = {
  id: "extensions-icon--ui-canvas",
  args: { name: "gallery-thumbnails" },
};
