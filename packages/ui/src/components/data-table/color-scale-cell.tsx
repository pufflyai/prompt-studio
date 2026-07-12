import { Text } from "@chakra-ui/react";
import { mixHexColors } from "./color-cell-style";
import type { DataTableColorScaleStop, DataTableThemeColor } from "./types";

interface ColorScaleCellProps {
  value: number;
}

const toDisplayPercent = (value: number) => Math.round(value * 100) / 100;

const mixColors = (startColor: string, endColor: string, startWeight: number) => {
  const mixedColor = mixHexColors(startColor, endColor, startWeight);
  if (mixedColor) return mixedColor;

  return `color-mix(in srgb, ${startColor} ${toDisplayPercent(startWeight * 100)}%, ${endColor})`;
};

const mixThemeColors = (start: DataTableThemeColor, end: DataTableThemeColor, startWeight: number) => {
  const foreground =
    start.foreground && end.foreground
      ? {
          light: mixColors(start.foreground.light, end.foreground.light, startWeight),
          dark: mixColors(start.foreground.dark, end.foreground.dark, startWeight),
        }
      : undefined;

  return {
    light: mixColors(start.light, end.light, startWeight),
    dark: mixColors(start.dark, end.dark, startWeight),
    ...(foreground ? { foreground } : {}),
  };
};

export const resolveColorScaleValue = (value: unknown, stops: DataTableColorScaleStop[]) => {
  if (typeof value !== "number" || !Number.isFinite(value) || stops.length < 2) return null;

  const firstStop = stops[0]!;
  const lastStop = stops[stops.length - 1]!;
  const range = lastStop.value - firstStop.value;
  if (range <= 0) return null;

  if (value <= firstStop.value) return firstStop.color;
  if (value >= lastStop.value) return lastStop.color;

  const endIndex = stops.findIndex((stop) => value <= stop.value);
  const startStop = stops[endIndex - 1]!;
  const endStop = stops[endIndex]!;
  const segmentProgress = (value - startStop.value) / (endStop.value - startStop.value);
  const startWeight = 1 - segmentProgress;
  return mixThemeColors(startStop.color, endStop.color, startWeight);
};

export const ColorScaleCell = (props: ColorScaleCellProps) => {
  const { value } = props;

  return (
    <Text textStyle="paragraph/S/medium" fontVariantNumeric="tabular-nums" truncate>
      {value}
    </Text>
  );
};
