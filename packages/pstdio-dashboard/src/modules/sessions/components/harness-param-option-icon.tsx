import { WorkbenchIcon } from "@pstdio/workbench/react";

// Match the planner's default priority palette without coloring other parameter icons.
const levelColors: Record<string, string> = {
  CircleSlash: "gray",
  "level-low": "gray",
  "level-mid": "blue",
  "level-high": "orange",
  "level-xhigh": "red",
  flame: "red",
};

export const harnessParamOptionColor = (icon: string | undefined) => (icon ? levelColors[icon] : undefined);

export const HarnessParamOptionIcon = (props: { name?: string }) => {
  const { name } = props;
  const color = harnessParamOptionColor(name);
  return <WorkbenchIcon name={name} size={14} color={color ? `${color}.500` : undefined} />;
};
