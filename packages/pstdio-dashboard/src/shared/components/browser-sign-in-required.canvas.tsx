import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ThemePreferenceProvider } from "@pstdio/ui";
import { BrowserSignInRequired } from "./browser-sign-in-required";

const meta = {
  title: "App/Browser sign-in required",
  component: BrowserSignInRequired,
  fullscreen: true,
} satisfies CanvasMeta<typeof BrowserSignInRequired>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Light: Story = {
  id: "app-browser-sign-in-required--light",
  decorators: [
    (Story) => (
      <ThemePreferenceProvider key="pstdio-light" initialPreference="pstdio-light">
        <Story />
      </ThemePreferenceProvider>
    ),
  ],
};
export const Dark: Story = {
  id: "app-browser-sign-in-required--dark",
  decorators: [
    (Story) => (
      <ThemePreferenceProvider key="pstdio-dark" initialPreference="pstdio-dark">
        <Story />
      </ThemePreferenceProvider>
    ),
  ],
};
