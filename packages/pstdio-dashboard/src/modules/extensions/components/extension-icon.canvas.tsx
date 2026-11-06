import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ExtensionIcon } from "./extension-icon";

export default {
  title: "Product/Settings/Extensions/Icon",
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

export const CustomSvg: Frame = {
  id: "extensions-icon--custom-svg",
  description: "Extension assets render as images, separate from Lucide icon names.",
  args: {
    name: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTIgMmg4djhoLTh6TTE0IDE0aDh2OGgtOHoiIGZpbGw9ImN1cnJlbnRDb2xvciIvPjwvc3ZnPg==",
  },
};
