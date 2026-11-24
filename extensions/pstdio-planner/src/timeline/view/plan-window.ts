export const PLAN_WINDOW_SIZE = 200;
export const PLAN_WINDOW_STEP = 100;

export const adjacentPlanWindow = (offset: number, direction: "previous" | "next", hasNext: boolean) => {
  if (direction === "previous") return Math.max(0, offset - PLAN_WINDOW_STEP);
  return hasNext ? offset + PLAN_WINDOW_STEP : offset;
};
