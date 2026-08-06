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
// The font builder normalises every glyph to a 1024-unit ink box sitting 47 units
// above the baseline of a 1000-unit em (ascent 850 / descent -150). Left alone the
// ink therefore renders larger than the box and ~21% of the font size too high, so
// both corrections below are expressed against the container to stay size-independent:
// 89.5% lands the ink on lucide's 22-of-24 optical size, 18.7% re-centres it.
const GLYPH_SIZE = "89.5cqmin";
const GLYPH_BASELINE_OFFSET = "18.7cqmin";

const GlyphRoot = chakra("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxSize: "1em",
    lineHeight: 1,
    containerType: "size",
    "&::before": {
      fontFamily: '"prompt-studio-icons", sans-serif',
      fontStyle: "normal",
      fontWeight: "normal",
      fontSize: GLYPH_SIZE,
      lineHeight: 1,
      transform: `translateY(${GLYPH_BASELINE_OFFSET})`,
    },
  },
});

type GlyphIconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children">;

/**
 * Builds a component for one `prompt-studio-icons` glyph so lucide icons and
 * font glyphs share a single component type in the icon registry.
 */
export const createGlyphIcon = (glyph: string): ComponentType<GlyphIconProps> => {
  const content = `"${glyphContent.get(glyph) ?? ""}"`;

  const GlyphIcon = (props: GlyphIconProps) => <GlyphRoot aria-hidden {...props} css={{ "&::before": { content } }} />;

  GlyphIcon.displayName = `GlyphIcon(${glyph})`;
  return GlyphIcon;
};
