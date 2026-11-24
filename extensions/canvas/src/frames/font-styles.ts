// Reuse immutable font blobs in the stylesheet. Blob parts keep the base64 payload out of
// per-frame JavaScript strings, and the resulting CSS works in any opaque or nested sandbox.
export const restoreFontStyle = async (style: Blob, read: (name: string) => Promise<Blob>) => {
  const css = await style.text();
  const parts: BlobPart[] = [];
  let end = 0;
  for (const match of css.matchAll(/url\("canvas-font:([a-f0-9]{64}\.(?:woff2?|otf|ttf|eot))"\)/g)) {
    parts.push(css.slice(end, match.index), 'url("', await read(match[1]), '")');
    end = match.index + match[0].length;
  }
  if (!parts.length) return style;
  parts.push(css.slice(end));
  return new Blob(parts, { type: "text/css" });
};
