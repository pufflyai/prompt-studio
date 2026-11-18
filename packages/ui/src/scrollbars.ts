import { radii, sizes } from "./theme/primitives/sizes";
import { scrollbarTokens } from "./theme/scrollbar-tokens";

/** CSS variables to capture from the owning Chakra surface for an isolated document. */
export const nativeScrollbarThemeTokens = {
  "--pstdio-scrollbar-size": `sizes-${scrollbarTokens.size}`,
  "--pstdio-scrollbar-thumb": `colors-${scrollbarTokens.thumb}`,
  "--pstdio-scrollbar-thumb-hover": `colors-${scrollbarTokens.thumbHover.replaceAll(".", "-")}`,
  "--pstdio-scrollbar-radius": `radii-${scrollbarTokens.radius}`,
};

/** System colors remain usable when no host theme has been captured. */
export const nativeScrollbarDefaults = {
  "--pstdio-scrollbar-size": sizes[scrollbarTokens.size].value,
  "--pstdio-scrollbar-thumb": "GrayText",
  "--pstdio-scrollbar-thumb-hover": "GrayText",
  "--pstdio-scrollbar-radius": radii[scrollbarTokens.radius].value,
};

/** Inline-safe scrollbar styling for documents outside the host's React tree. */
export const nativeScrollbarCss = `
* { scrollbar-width: thin; scrollbar-color: var(--pstdio-scrollbar-thumb, GrayText) transparent; }
@supports selector(::-webkit-scrollbar) {
  * { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar {
    width: var(--pstdio-scrollbar-size, ${nativeScrollbarDefaults["--pstdio-scrollbar-size"]});
    height: var(--pstdio-scrollbar-size, ${nativeScrollbarDefaults["--pstdio-scrollbar-size"]});
  }
  ::-webkit-scrollbar-track, ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: var(--pstdio-scrollbar-thumb, GrayText);
    border-radius: var(--pstdio-scrollbar-radius, ${nativeScrollbarDefaults["--pstdio-scrollbar-radius"]});
  }
  ::-webkit-scrollbar-thumb:hover, ::-webkit-scrollbar-thumb:active {
    background: var(--pstdio-scrollbar-thumb-hover, GrayText);
  }
}
`;
