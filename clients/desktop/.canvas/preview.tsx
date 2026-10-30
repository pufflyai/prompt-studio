import "@pstdio/ui/style.css";
import type { CanvasPreview } from "@pstdio/canvas";
import { ChakraProvider, psTheme } from "@pstdio/ui";

const preview: CanvasPreview = {
  decorators: [
    (Story) => (
      <ChakraProvider value={psTheme}>
        <Story />
      </ChakraProvider>
    ),
  ],
};
export default preview;
