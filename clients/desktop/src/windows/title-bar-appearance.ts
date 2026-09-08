export const titleBarOverlayOptions = (value: unknown) => {
  if (
    !value ||
    typeof value !== "object" ||
    !("color" in value) ||
    typeof value.color !== "string" ||
    !("symbolColor" in value) ||
    typeof value.symbolColor !== "string"
  ) {
    throw new Error("Invalid title bar appearance");
  }
  return { color: value.color, symbolColor: value.symbolColor };
};
