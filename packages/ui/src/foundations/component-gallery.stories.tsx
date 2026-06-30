import type { Meta, StoryObj } from "@storybook/react-vite";
import { GalleryFrame } from "./gallery/gallery-frame";
import { BadgesSection } from "./gallery/sections/badges-section";
import { ButtonsSection } from "./gallery/sections/buttons-section";
import { FeedbackSection } from "./gallery/sections/feedback-section";
import { InputsSection } from "./gallery/sections/inputs-section";
import { LayoutSection } from "./gallery/sections/layout-section";
import { OverlaysSection } from "./gallery/sections/overlays-section";

// One canvas that renders every light component family together. Flip the
// Storybook "theme" toolbar (pstdio-light / pstdio-dark) to see the impact of a
// token or recipe change across the whole system at once.

const meta = {
  title: "Foundations/Component Gallery",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Overview: Story = {
  render: () => (
    <GalleryFrame
      kicker="Foundations"
      title="Component gallery"
      summary="Every lightweight @pstdio/ui family on one canvas. Switch the theme in the toolbar to review a visual change everywhere at once."
    >
      <ButtonsSection />
      <InputsSection />
      <FeedbackSection />
      <BadgesSection />
      <OverlaysSection />
      <LayoutSection />
    </GalleryFrame>
  ),
};
