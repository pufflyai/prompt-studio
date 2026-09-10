export const createShaderIconTexture = async (codepoint: string) => {
  const glyph = String.fromCodePoint(Number.parseInt(codepoint, 16));
  const font = '400px "prompt-studio-icons"';
  await document.fonts.load(font, glyph);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d")!;
  context.font = font;
  context.fillStyle = "white";
  const bounds = context.measureText(glyph);
  const width = bounds.actualBoundingBoxLeft + bounds.actualBoundingBoxRight;
  const height = bounds.actualBoundingBoxAscent + bounds.actualBoundingBoxDescent;
  context.fillText(
    glyph,
    (512 - width) / 2 + bounds.actualBoundingBoxLeft,
    (512 - height) / 2 + bounds.actualBoundingBoxAscent,
  );
  return canvas;
};
