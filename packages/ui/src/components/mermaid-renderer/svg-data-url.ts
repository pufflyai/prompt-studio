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

// SVG data URLs are parsed as strict XML by the browser; void HTML tags like `<br>`
// must be self-closing or the image silently fails to decode (naturalWidth becomes 0).
// Mermaid emits `<br/>` itself, but DOMPurify (used when securityLevel !== "loose")
// normalises it back to the HTML5 form.
const closeVoidHtmlTags = (svg: string) => svg.replace(/<br(\s[^>]*)?>/g, "<br$1/>");

export const normalizeSvgForImage = (svg: string) => {
  const { width, height } = resolveSvgSize(svg);

  const sized = svg.replace(/<svg\b[^>]*>/, (tag) => {
    const withWidth = /\swidth=/.test(tag)
      ? tag.replace(/\swidth="[^"]*"/, ` width="${width}"`)
      : tag.replace("<svg", `<svg width="${width}"`);

    return /\sheight=/.test(withWidth)
      ? withWidth.replace(/\sheight="[^"]*"/, ` height="${height}"`)
      : withWidth.replace("<svg", `<svg height="${height}"`);
  });

  return closeVoidHtmlTags(sized);
};

export const createSvgDataUrl = (svg: string) => {
  const bytes = new TextEncoder().encode(normalizeSvgForImage(svg));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `data:image/svg+xml;base64,${btoa(binary)}`;
};
