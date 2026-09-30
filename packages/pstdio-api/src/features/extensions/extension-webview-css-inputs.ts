// CSS URLs are relative to the stylesheet even without a leading "./".
export const collectLocalCssInputs = (content: string) => {
  const inputs: string[] = [];
  const css = content.replace(/\/\*[\s\S]*?\*\//g, "");
  const references =
    /@import\s+(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')|url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^)]*))\s*\)/gi;
  for (const match of css.matchAll(references)) {
    const value = match
      .slice(1)
      .find((part) => part !== undefined)
      ?.trim();
    if (!value) continue;
    const path = value.replace(/\\([\da-f]{1,6})\s?|\\(.)/gi, (_match, hex: string | undefined, escaped: string) =>
      hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : escaped,
    );
    if (path.startsWith("/") || path.startsWith("#") || /^[a-z][a-z\d+.-]*:/i.test(path)) continue;
    inputs.push(`./${path.split(/[?#]/, 1)[0]}`);
  }
  return inputs;
};
