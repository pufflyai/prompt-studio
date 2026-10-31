import type { CanvasPreview } from "@pstdio/canvas";
import { RootProvider } from "../src/components/root-provider";

const preview: CanvasPreview = {
  decorators: [
    (Story) => (
      <RootProvider>
        <Story />
      </RootProvider>
    ),
  ],
};
export default preview;
