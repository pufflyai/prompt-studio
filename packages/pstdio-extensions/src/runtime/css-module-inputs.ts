// CSS imports resolve as modules; URL assets remain relative to their stylesheet.
export const cssModuleInputs = (source: string) => {
  const inputs: string[] = [];
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const references =
    /(@import\s+)(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')|url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^)]*))\s*\)/gi;
  for (const match of css.matchAll(references)) {
    const value = match
      .slice(2)
      .find((part) => part !== undefined)
      ?.trim();
    if (!value) continue;
    const path = value
      .replace(/\\([\da-f]{1,6})\s?|\\(.)/gi, (_match, hex: string | undefined, escaped: string) =>
        hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : escaped,
      )
      .split(/[?#]/, 1)[0]!;
    if (!path || path.startsWith("/") || path.startsWith("#") || /^[a-z][a-z\d+.-]*:/i.test(path)) continue;
    const imported = match[1] || /@import\s*$/.test(css.slice(0, match.index));
    inputs.push(imported ? path : `./${path}`);
  }
  return inputs;
};
