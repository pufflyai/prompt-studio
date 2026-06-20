const parseSvgLength = (value: string | undefined) => {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const readAttribute = (svg: string, name: string) => {
  const match = svg.match(new RegExp(`\\s${name}="([^"]+)"`));
  return match?.[1];
};

export const resolveSvgSize = (svg: string) => {
  const viewBox = readAttribute(svg, "viewBox")?.split(/\s+/).map(Number) ?? [];
  const viewBoxWidth = viewBox[2] ?? 0;
  const viewBoxHeight = viewBox[3] ?? 0;

  if (viewBoxWidth > 0 && viewBoxHeight > 0) {
    return { width: viewBoxWidth, height: viewBoxHeight };
  }

  return {
    width: Math.max(parseSvgLength(readAttribute(svg, "width")), 1),
    height: Math.max(parseSvgLength(readAttribute(svg, "height")), 1),
  };
};

export const normalizeSvgForImage = (svg: string) => {
  const { width, height } = resolveSvgSize(svg);

  return svg.replace(/<svg\b[^>]*>/, (tag) => {
    const withWidth = /\swidth=/.test(tag)
      ? tag.replace(/\swidth="[^"]*"/, ` width="${width}"`)
      : tag.replace("<svg", `<svg width="${width}"`);

    return /\sheight=/.test(withWidth)
      ? withWidth.replace(/\sheight="[^"]*"/, ` height="${height}"`)
      : withWidth.replace("<svg", `<svg height="${height}"`);
  });
};

export const createSvgDataUrl = (svg: string) => {
  const bytes = new TextEncoder().encode(normalizeSvgForImage(svg));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `data:image/svg+xml;base64,${btoa(binary)}`;
};
