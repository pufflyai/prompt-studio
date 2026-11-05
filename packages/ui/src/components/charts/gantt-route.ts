import { d3Curve } from "@tanstack/charts";

// Dependency paths enter the successor from the left, including same-time starts.
const dependencyCurve: Parameters<typeof d3Curve>[0] = (context) => {
  let points: [number, number][] = [];
  return {
    areaStart() {},
    areaEnd() {},
    lineStart() {
      points = [];
    },
    point(x, y) {
      points.push([x, y]);
    },
    lineEnd() {
      if (points.length < 2) return;
      const [x, y] = points[0];
      const [targetX, targetY] = points[points.length - 1];
      const tip = targetX - 3;
      const exit = x + 10;
      context.moveTo(x, y);
      context.lineTo(exit, y);
      if (tip <= exit) {
        const gutterY = targetY - Math.sign(targetY - y || 1) * 16;
        context.lineTo(exit, gutterY);
        context.lineTo(tip - 10, gutterY);
        context.lineTo(tip - 10, targetY);
      } else {
        context.lineTo(exit, targetY);
      }
      context.lineTo(tip, targetY);
      context.moveTo(tip - 4, targetY - 3);
      context.lineTo(tip, targetY);
      context.lineTo(tip - 4, targetY + 3);
    },
  };
};

export const dependencyRoute = d3Curve(dependencyCurve);
