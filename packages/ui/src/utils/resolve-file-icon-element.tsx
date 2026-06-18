import { Folder } from "lucide-react";
import type { CSSProperties } from "react";

import { type FileIconThemePreferenceOption, resolveFileIconGlyph } from "./apply-file-icon-theme-preference";
import { getFileTypeIcon } from "./get-file-type-icon";

interface ResolveFileIconElementOptions {
  isDirectory?: boolean;
  theme?: FileIconThemePreferenceOption;
  size?: number;
}

// Renders a contributed icon-font glyph when the active theme matches; otherwise falls back to Lucide icons.
export const resolveFileIconElement = (filename: string, options: ResolveFileIconElementOptions = {}) => {
  const { isDirectory = false, theme, size = 16 } = options;

  const glyph = resolveFileIconGlyph(theme, filename, isDirectory);
  if (glyph) {
    const style: CSSProperties = {
      fontFamily: `"${glyph.fontFamily}"`,
      color: glyph.fontColor,
      fontSize: size,
      lineHeight: 1,
      display: "inline-flex",
    };
    return (
      <span aria-hidden="true" style={style}>
        {glyph.fontCharacter}
      </span>
    );
  }

  if (isDirectory) return <Folder size={size} />;

  const Icon = getFileTypeIcon(filename);
  return <Icon size={size} />;
};
