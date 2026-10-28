import type { CanvasProject } from "@pstdio/canvas";
import { RootProvider } from "../src/components/root-provider";

const preview: CanvasProject = {
  decorators: [
    (Story) => (
      <RootProvider>
        <Story />
      </RootProvider>
    ),
  ],
};
export default preview;
