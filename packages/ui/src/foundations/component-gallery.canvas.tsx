import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { ReactNode } from "react";
import { TokenEditorOverlay, TokenPreviewScope } from "@/components/internal/style-guide";
import { useTokenEditorValues } from "@/components/internal/token-editor-state";
import { useThemePreference } from "@/utils/theme-preference";
import { GalleryFrame } from "./gallery/gallery-frame";
import { BadgesSection } from "./gallery/sections/badges-section";
import { ButtonsSection } from "./gallery/sections/buttons-section";
import { CompositesSection } from "./gallery/sections/composites-section";
import { FeedbackSection } from "./gallery/sections/feedback-section";
import { InputsSection } from "./gallery/sections/inputs-section";
import { LayoutSection } from "./gallery/sections/layout-section";
import { NavigationIdentitySection } from "./gallery/sections/navigation-identity-section";
import { OverlaysSection } from "./gallery/sections/overlays-section";
import { PanelsSection } from "./gallery/sections/panels-section";

// Compare component families with each frame's theme or predefined variants.
const meta = {
  title: "Foundations/Component Gallery",
  fullscreen: true,
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant;
const TokenizedGallery = (props: { children: ReactNode }) => {
  const { children } = props;
  const { themePreference, themePreferences } = useThemePreference();
  const { basePresetId, baseValues, values, setValues } = useTokenEditorValues({ themePreference, themePreferences });
  return (
    <TokenPreviewScope values={values}>
      <TokenEditorOverlay basePresetId={basePresetId} baseValues={baseValues} values={values} onChange={setValues} />
      {children}
    </TokenPreviewScope>
  );
};
const FoundationsGallery = () => (
  <TokenizedGallery>
    <GalleryFrame
      kicker="Foundations"
      title="Component gallery"
      summary="Every lightweight @pstdio/ui family on one canvas. Open the token editor to explore presets and tune token values against the live gallery."
    >
      <ButtonsSection />
      <InputsSection />
      <NavigationIdentitySection />
      <FeedbackSection />
      <BadgesSection />
      <OverlaysSection />
      <LayoutSection />
    </GalleryFrame>
  </TokenizedGallery>
);
const CompositesGallery = () => (
  <TokenizedGallery>
    <GalleryFrame
      kicker="Composites"
      title="Advanced component gallery"
      summary="Higher-level @pstdio/ui surfaces composed from primitives and local patterns. Use these examples before assembling dense product workflows from scratch."
    >
      <CompositesSection />
    </GalleryFrame>
  </TokenizedGallery>
);
const PanelsGallery = () => (
  <TokenizedGallery>
    <GalleryFrame
      kicker="Panels"
      title="Panel gallery"
      summary="Reusable panel shells and framed content layouts for dense application surfaces."
    >
      <PanelsSection />
    </GalleryFrame>
  </TokenizedGallery>
);
export const Foundations: Story = {
  id: "foundations-component-gallery--foundations",
  render: () => <FoundationsGallery />,
};

export const PromptLight: Story = {
  id: "foundations-component-gallery--prompt-light",
  render: () => <FoundationsGallery />,
  defaultTheme: "pstdio-light",
};
export const PromptDark: Story = {
  id: "foundations-component-gallery--prompt-dark",
  render: () => <FoundationsGallery />,
  defaultTheme: "pstdio-dark",
};
export const PromptContrastLight: Story = {
  id: "foundations-component-gallery--prompt-contrast-light",
  render: () => <FoundationsGallery />,
  defaultTheme: "prompt-contrast-light",
};
export const PromptContrastDark: Story = {
  id: "foundations-component-gallery--prompt-contrast-dark",
  render: () => <FoundationsGallery />,
  defaultTheme: "prompt-contrast-dark",
};

export const FlatImportedPalette: Story = {
  id: "foundations-component-gallery--flat-imported-palette",
  render: () => <FoundationsGallery />,
  defaultTheme: "vscode-flat-dark",
};

export const Composites: Story = {
  id: "foundations-component-gallery--composites",
  render: () => <CompositesGallery />,
};
export const Panels: Story = {
  id: "foundations-component-gallery--panels",
  render: () => <PanelsGallery />,
};
