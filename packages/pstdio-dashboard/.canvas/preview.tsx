import "@pstdio/ui/style.css";

import { ChakraProvider, psTheme } from "@pstdio/ui";
import type { Preview } from "@storybook/react-vite";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <ChakraProvider value={psTheme}>
          <Story />
        </ChakraProvider>
      </I18nextProvider>
    ),
  ],
};

export default preview;
