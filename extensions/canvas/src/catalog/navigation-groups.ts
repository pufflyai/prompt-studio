export const canvasGroups = ["Design System", "Workbench Core", "Dashboard", "Extensions", "Landing Page"] as const;

export const storyLocation = (suite: string, topic: string, source: string) => {
  let path = topic.split("/").slice(0, -1);
  if (suite === "website") return { group: "Landing Page", path: path.filter((part) => part !== "Landing") };
  let group = "Dashboard";
  if (source.startsWith("packages/pstdio-dashboard/src/shared/extensions/")) {
    return { group: "Workbench Core", path: ["Chrome", "Extensions"] };
  }
  if (suite === "ui" || suite === "themes") group = "Design System";
  else if (suite === "workbench") {
    group = "Workbench Core";
    path = path.filter((part) => part !== "pstdio-workbench" && part !== "Workbench");
  } else if (source.startsWith("extensions/") || source.startsWith(".pstdio/extensions/")) {
    group = "Extensions";
    if (path[0] === "Extensions") path = path.slice(1);
  }
  return { group, path };
};
