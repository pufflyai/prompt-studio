export const crossRectangles = (width: number, height: number) => {
  const armWidth = (width * 6) / 26;
  const armHeight = (height * 6) / 26;
  const insetX = (width - armWidth) / 2;
  const insetY = (height - armHeight) / 2;
  return [
    { x: insetX, y: 0, width: armWidth, height },
    { x: 0, y: insetY, width: insetX, height: armHeight },
    { x: insetX + armWidth, y: insetY, width: insetX, height: armHeight },
  ];
};

export const crossPath = (width: number, height: number) => {
  const [vertical, horizontal] = crossRectangles(width, height);
  const left = vertical.x;
  const right = left + vertical.width;
  const top = horizontal.y;
  const bottom = top + horizontal.height;
  return `M${left} 0H${right}V${top}H${width}V${bottom}H${right}V${height}H${left}V${bottom}H0V${top}H${left}Z`;
};

export const halfDiscPath = (width: number, height: number) =>
  `M0 ${height}A${width / 2} ${height} 0 0 1 ${width} ${height}Z`;

export const halfDiscVertices = (width: number, height: number) => {
  // At the largest tool size, 32 segments stay within a tenth of a pixel of the SVG arc.
  const segments = 32;
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = (index * Math.PI) / segments;
    return { x: (width / 2) * (1 - Math.cos(angle)), y: height * (1 - Math.sin(angle)) };
  });
};
