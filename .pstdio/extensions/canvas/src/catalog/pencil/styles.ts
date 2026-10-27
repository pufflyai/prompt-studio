import type { CSSProperties } from "react";
import {
  type DesignDocument,
  type DesignEffect,
  type DesignNode,
  type DesignPaint,
  type DesignTheme,
  resolveDesignValue,
} from "./model";

const alignment = (value: unknown) => String(value ?? "start").replaceAll("_", "-");
const pixels = (value: unknown) => (typeof value === "number" ? `${value}px` : String(value ?? 0));
interface StyleContext {
  node: DesignNode;
  parent?: DesignNode;
  document: DesignDocument;
  value: (input: unknown) => unknown;
  color: (input: unknown) => string;
}
const dimensionsStyle = ({ node, parent, value }: StyleContext) => {
  const style: CSSProperties = {};
  const parentVertical = parent?.layout === "vertical";
  const dimension = (axis: "width" | "height") => {
    const size = value(node[axis]);
    if (typeof size === "number") {
      style[axis] = size;
      return;
    }
    if (typeof size !== "string") return;
    if (size.startsWith("fill_container")) {
      const main = axis === "width" ? !parentVertical : parentVertical;
      if (main && parent?.layout !== "none") {
        style.flexGrow = 1;
        style.flexBasis = 0;
      } else {
        style.alignSelf = "stretch";
        style[axis] = "100%";
      }
    } else if (size.startsWith("fit_content")) style[axis] = "max-content";
  };
  dimension("width");
  dimension("height");
  if (parent && (parent.layout === "none" || node.layoutPosition === "absolute")) {
    style.position = "absolute";
    style.left = node.x ?? 0;
    style.top = node.y ?? 0;
    if (String(node.width).startsWith("fill_container")) {
      style.width = "100%";
      style.flexGrow = undefined;
    }
    if (String(node.height).startsWith("fill_container")) {
      style.height = "100%";
      style.flexGrow = undefined;
    }
  }
  return style;
};

const layoutStyle = ({ node, value }: StyleContext) => {
  const style: CSSProperties = {};
  style.display = node.type === "frame" || node.type === "group" ? "flex" : "block";
  if (node.layout === "none") style.display = "block";
  style.flexDirection = node.layout === "vertical" ? "column" : "row";
  style.alignItems = alignment(node.alignItems);
  style.justifyContent = alignment(node.justifyContent);
  style.gap = pixels(value(node.gap));
  if (node.padding !== undefined)
    style.padding = (Array.isArray(node.padding) ? node.padding : [node.padding])
      .map((p) => pixels(value(p)))
      .join(" ");
  if (node.cornerRadius !== undefined)
    style.borderRadius = (Array.isArray(node.cornerRadius) ? node.cornerRadius : [node.cornerRadius])
      .map((p) => pixels(value(p)))
      .join(" ");
  if (node.type === "ellipse") style.borderRadius = "50%";
  if (node.opacity !== undefined) style.opacity = Number(value(node.opacity));
  if (node.clip) style.overflow = "hidden";
  const transforms: string[] = [];
  if (node.rotation) transforms.push(`rotate(${-Number(value(node.rotation))}deg)`);
  if (node.flipX) transforms.push("scaleX(-1)");
  if (node.flipY) transforms.push("scaleY(-1)");
  if (transforms.length) style.transform = transforms.join(" ");
  return style;
};

const paintBackground = (document: DesignDocument, fill: DesignPaint, resolveColor: (input: unknown) => string) => {
  if (fill.enabled === false) return "";
  const color = (input: unknown) =>
    fill.opacity === undefined
      ? resolveColor(input)
      : `color-mix(in srgb, ${resolveColor(input)} ${fill.opacity * 100}%, transparent)`;
  if (fill.type === "image")
    return `url(${JSON.stringify(document.assets?.[fill.url!] ?? fill.url)}) center/${fill.mode === "contain" ? "contain" : "cover"} no-repeat`;
  if (fill.type === "gradient") {
    const stops = fill.colors?.map((stop) => `${color(stop.color)} ${stop.position * 100}%`).join(",");
    if (fill.gradientType === "radial") return `radial-gradient(ellipse,${stops})`;
    return `linear-gradient(${90 - (fill.rotation ?? 0)}deg,${stops})`;
  }
  return fill.color ? `linear-gradient(${color(fill.color)},${color(fill.color)})` : "";
};
const fillStyle = ({ node, document, color }: StyleContext) => {
  const style: CSSProperties = {};
  const fills = (Array.isArray(node.fill) ? node.fill : [node.fill]).filter(
    (fill): fill is string | DesignPaint => fill !== undefined,
  );
  const backgrounds: string[] = [];
  for (const fill of fills) {
    if (typeof fill === "string") {
      if (node.type === "text" || node.type === "icon") style.color = color(fill);
      else backgrounds.push(`linear-gradient(${color(fill)},${color(fill)})`);
    } else {
      const background = paintBackground(document, fill, color);
      if (background) backgrounds.push(background);
    }
  }
  if (backgrounds.length) style.background = backgrounds.reverse().join(",");
  return style;
};

const strokeStyle = ({ node, value, color }: StyleContext) => {
  const style: CSSProperties = {};
  if (node.stroke) {
    style.borderColor = color(typeof node.stroke === "object" ? (node.stroke as DesignPaint).color : node.stroke);
    style.borderStyle = "solid";
    const widths = node.strokeWidth ?? 1;
    if (typeof widths === "object" && widths) {
      const sides = widths as Record<string, unknown>;
      style.borderWidth = ["top", "right", "bottom", "left"].map((side) => pixels(value(sides[side] ?? 0))).join(" ");
    } else style.borderWidth = pixels(value(widths));
  }
  return style;
};

const effectStyle = ({ node, color }: StyleContext) => {
  const style: CSSProperties = {};
  const effects = (Array.isArray(node.effect) ? node.effect : [node.effect]).filter(Boolean) as DesignEffect[];
  const shadows: string[] = [];
  for (const effect of effects) {
    if (effect.enabled === false) continue;
    if (effect.type === "shadow")
      shadows.push(
        `${effect.shadowType === "inner" ? "inset " : ""}${effect.offset?.x ?? 0}px ${effect.offset?.y ?? 0}px ${effect.blur ?? 0}px ${effect.spread ?? 0}px ${color(effect.color)}`,
      );
    if (effect.type === "background_blur") style.backdropFilter = `blur(${effect.radius}px)`;
    if (effect.type === "blur") style.filter = `blur(${effect.radius}px)`;
  }
  if (shadows.length) style.boxShadow = shadows.join(",");
  return style;
};

const textStyle = ({ node, value, color }: StyleContext) => {
  const style: CSSProperties = {};
  if (node.type === "text") {
    style.fontFamily = `${color(node.fontFamily)}, sans-serif`;
    style.fontSize = Number(value(node.fontSize) ?? 14);
    style.fontWeight = String(value(node.fontWeight) ?? "normal");
    style.fontStyle = node.fontStyle as CSSProperties["fontStyle"];
    style.lineHeight = Number(value(node.lineHeight) ?? 1.2);
    style.letterSpacing = Number(value(node.letterSpacing) ?? 0);
    style.textAlign = node.textAlign as CSSProperties["textAlign"];
    style.whiteSpace = node.textGrowth || node.width ? "pre-wrap" : "pre";
    style.overflowWrap = "anywhere";
  }
  return style;
};

// Layout and paint values come from the imported design, rather than product style overrides.
export const designNodeStyle = (
  document: DesignDocument,
  node: DesignNode,
  theme: DesignTheme,
  parent?: DesignNode,
) => {
  const value = (input: unknown) => resolveDesignValue(document, input, theme);
  const color = (input: unknown) => String(value(input) ?? "transparent");
  const context = { document, node, parent, value, color };
  return {
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    minWidth: 0,
    minHeight: 0,
    ...dimensionsStyle(context),
    ...layoutStyle(context),
    ...fillStyle(context),
    ...strokeStyle(context),
    ...effectStyle(context),
    ...textStyle(context),
  } satisfies CSSProperties;
};
