import "@pstdio/ui/style.css";
import "./preview.css";
import type { Preview } from "@storybook/react-vite";

// Theming is owned by the workbench: `Workbench` reads `workbench.themes` and
// mounts its own `WorkbenchThemeProvider`. Stories add no theme decorator.
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
