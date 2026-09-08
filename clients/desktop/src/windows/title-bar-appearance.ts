export interface TitleBarAppearance {
  color: string;
  symbolColor: string;
  height: number;
}

export const titleBarOverlayOptions = (value: unknown) => {
  if (
    !value ||
    typeof value !== "object" ||
    !("color" in value) ||
    typeof value.color !== "string" ||
    !("symbolColor" in value) ||
    typeof value.symbolColor !== "string" ||
    !("height" in value) ||
    typeof value.height !== "number" ||
    !Number.isInteger(value.height) ||
    value.height <= 0
  ) {
    throw new Error("Invalid title bar appearance");
  }
  return { color: value.color, symbolColor: value.symbolColor, height: value.height };
};
