import "@pstdio/ui/style.css";
import type { CanvasProject } from "@pstdio/canvas";
import { ChakraProvider, psTheme } from "@pstdio/ui";

const preview: CanvasProject = {
  decorators: [
    (Story) => (
      <ChakraProvider value={psTheme}>
        <Story />
      </ChakraProvider>
    ),
  ],
};
export default preview;
