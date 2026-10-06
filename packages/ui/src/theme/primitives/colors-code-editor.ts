// Monaco needs concrete color strings, so its fallback theme uses raw tokens.
// Values stay literal because `system.token()` returns a CSS variable for token references.
// Theme preferences with their own Monaco theme replace these colors.
export const codeEditor = {
  background: { value: "#0a0d15" },
  foreground: { value: "#f5f5f5" },
  lineHighlightBackground: { value: "#22252C" },
  cursor: { value: "#A7A7A7" },
  whitespace: { value: "#3B3B3B" },
  indentGuide: { value: "#404040" },
  indentGuideActive: { value: "#707070" },
};
