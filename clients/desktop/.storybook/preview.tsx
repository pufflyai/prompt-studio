import "@pstdio/ui/style.css";

import { ChakraProvider, psTheme } from "@pstdio/ui";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  decorators: [
    (Story) => (
      <ChakraProvider value={psTheme}>
        <Story />
      </ChakraProvider>
    ),
  ],
};

export default preview;
