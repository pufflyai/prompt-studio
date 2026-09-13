import type { Preview } from "@storybook/react-vite";
import { RootProvider } from "../src/components/root-provider";

const preview: Preview = {
  decorators: [
    (Story) => (
      <RootProvider>
        <Story />
      </RootProvider>
    ),
  ],
};

export default preview;
