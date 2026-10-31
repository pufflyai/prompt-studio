export const rgba = (color: string) => {
  let hex = color.replace(/^#/, "");
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map((digit) => digit.repeat(2)).join("");
  return [0, 2, 4, 6].map((offset) =>
    offset === 6 && hex.length === 6 ? 1 : Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
};

const hexColor = (channels: number[]) =>
  `#${channels
    .slice(0, 3)
    .map((value) =>
      Math.round(value * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;

export const opaque = (color: string, background: string) => {
  const [r, g, b, alpha] = rgba(color);
  const base = rgba(background);
  return hexColor([r, g, b].map((value, index) => value * alpha + base[index] * (1 - alpha)));
};

export const mix = (color: string, other: string, amount: number) => {
  const base = rgba(other);
  return hexColor(
    rgba(color)
      .slice(0, 3)
      .map((value, index) => value * (1 - amount) + base[index] * amount),
  );
};

export const luminance = (color: string) => {
  const [r, g, b] = rgba(color).map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
};

export const contrast = (a: string, b: string) => {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

export const readable = (background: string, preferred: string) => {
  if (contrast(background, preferred) >= 4.5) return preferred;
  return luminance(background) > 0.179 ? "#000000" : "#FFFFFF";
};
