import { chakra } from "@chakra-ui/react";
import type { ComponentType, HTMLAttributes } from "react";
// Package-relative on purpose: every host that resolves `@pstdio/ui` from source
// would otherwise need its own `$fonts` alias.
import generatedGlyphStyles from "../../../public/font/css/prompt-studio-icons.css?raw";
import "./glyph-icon.css";

// The generated stylesheet is the source of truth for glyph codepoints; reading
// them here keeps `@pstdio/ui` from bundling its legacy @font-face formats.
const GLYPH_RULE = /\.icon-([\w-]+)::before\s*\{\s*content:\s*"(\\[0-9a-f]+)"/g;

const glyphContent = new Map(
  Array.from(generatedGlyphStyles.matchAll(GLYPH_RULE), ([, name, content]) => [name, content]),
);

// Glyphs are painted through a ::before pseudo element sized by font-size, so
// the wrapper turns its own box into a size container. That lets the glyph track
// whatever box the caller gives it (`boxSize` on a Chakra `Icon`, say) exactly
// like a lucide SVG would.
//
// The ::before is taken out of flow and stretched over the wrapper so its geometry
// never depends on the wrapper's own display mode — callers that reach through
// Chakra's `Icon` blockify it, which silently breaks flex centring.
//
// Within that box the font builder normalises every glyph's ink to a 1024-unit box
// sitting 47 units above the baseline of a 1000-unit em (ascent 850 / descent -150).
// The ink therefore renders larger than the em and half its overhang above centre:
// 89.5% of the container lands it on lucide's 22-of-24 optical size, and 0.209em
// (measured against the glyph's own font size, so it follows any optical scale)
// drops it back onto the centre line.
const GLYPH_OPTICAL_SIZE = 89.5;
const GLYPH_BASELINE_OFFSET = "0.209em";

const GlyphRoot = chakra("span", {
  base: {
    position: "relative",
    display: "inline-block",
    flexShrink: 0,
    boxSize: "1em",
    lineHeight: 1,
    containerType: "size",
    "&::before": {
      position: "absolute",
      inset: 0,
      fontFamily: '"prompt-studio-icons", sans-serif',
      fontStyle: "normal",
      fontWeight: "normal",
      lineHeight: "100cqmin",
      textAlign: "center",
      transform: `translateY(${GLYPH_BASELINE_OFFSET})`,
    },
  },
});

type GlyphIconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children">;

export interface GlyphIconOptions {
  /**
   * Optical size relative to a round glyph. Every glyph is normalised to the same
   * ink box, so square marks such as the level bars need trimming to carry the
   * same visual weight as the status rings.
   */
  scale?: number;
}

/**
 * Builds a component for one `prompt-studio-icons` glyph so lucide icons and
 * font glyphs share a single component type in the icon registry.
 */
export const createGlyphIcon = (glyph: string, options: GlyphIconOptions = {}): ComponentType<GlyphIconProps> => {
  const content = `"${glyphContent.get(glyph) ?? ""}"`;
  const fontSize = `${(GLYPH_OPTICAL_SIZE * (options.scale ?? 1)).toFixed(1)}cqmin`;

  const GlyphIcon = (props: GlyphIconProps) => (
    <GlyphRoot aria-hidden {...props} css={{ "&::before": { content, fontSize } }} />
  );

  GlyphIcon.displayName = `GlyphIcon(${glyph})`;
  return GlyphIcon;
};
