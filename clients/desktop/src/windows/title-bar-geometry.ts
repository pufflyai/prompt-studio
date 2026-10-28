/** Native title-bar coordinates in device-independent pixels, before renderer zoom. */
export interface TitleBarGeometry {
  x: number;
  width: number;
}

export const parseTitleBarGeometry = (value: unknown) => {
  if (
    !value ||
    typeof value !== "object" ||
    !("x" in value) ||
    typeof value.x !== "number" ||
    !Number.isFinite(value.x) ||
    value.x < 0 ||
    !("width" in value) ||
    typeof value.width !== "number" ||
    !Number.isFinite(value.width) ||
    value.width < 0
  ) {
    throw new Error("Invalid title bar geometry");
  }
  return { x: value.x, width: value.width };
};
