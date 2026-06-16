/**
 * Core-owned contract for file icon theme registrations. Structurally identical
 * to @pstdio/ui's FileIconThemePreferenceOption; the React layer bridges the two
 * so core does not depend on UI package ownership.
 */
export interface FileIconThemeFont {
  fontFamily: string;
  src: { url: string; format?: string }[];
  weight?: string;
  style?: string;
}

export interface FileIconThemePreferenceOption {
  id: string;
  title?: string;
  definitions: Record<string, unknown>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  defaults: { file?: string; folder?: string };
  fonts: FileIconThemeFont[];
}
