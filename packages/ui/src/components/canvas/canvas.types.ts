import type { BoxProps, RecipeVariantProps } from "@chakra-ui/react";
import type { Ref } from "react";
import type { canvasRecipe } from "../../theme/recipes/canvas";

export interface CanvasPoint {
  x: number;
  y: number;
}
export interface CanvasCamera extends CanvasPoint {
  zoom: number;
}
export interface CanvasZoomChange {
  factor: number;
  anchor: CanvasPoint;
  /** Pinch movement can move the anchor while changing scale. */
  targetAnchor?: CanvasPoint;
}
export interface CanvasZoomLimits {
  minZoom: number;
  maxZoom: number;
}
export interface CanvasNavigation {
  /** Screen-pixel movement of the content. Native scroll callers negate these deltas. */
  onPan: (delta: CanvasPoint) => void;
  onZoom: (change: CanvasZoomChange) => void;
  /** Commit after a pointer gesture or an idle wheel/keyboard burst. Also flushes on unmount. */
  onNavigationEnd?: () => void;
  onFit?: () => void;
  onReset?: () => void;
}
type OwnedHandlers =
  | "onPointerDownCapture"
  | "onPointerMoveCapture"
  | "onPointerUpCapture"
  | "onPointerCancelCapture"
  | "onLostPointerCapture"
  | "onClickCapture"
  | "onAuxClickCapture";
export interface CanvasProps
  extends Omit<BoxProps, OwnedHandlers | keyof CanvasNavigation>,
    CanvasNavigation,
    RecipeVariantProps<typeof canvasRecipe> {
  ref?: Ref<HTMLDivElement>;
}
