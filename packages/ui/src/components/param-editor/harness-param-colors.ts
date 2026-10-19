const levelColors: Record<string, string> = {
  CircleSlash: "gray",
  "level-low": "gray",
  "level-mid": "blue",
  "level-high": "orange",
  "level-xhigh": "red",
  flame: "red",
};

export const harnessParamOptionColor = (icon: string | undefined) => (icon ? levelColors[icon] : undefined);
