export const canvasGroups = ["Design System", "Workbench Core", "Dashboard", "Extensions"] as const;

export const storyLocation = (suite: string, topic: string) => {
  let path = topic.split("/").slice(0, -1);
  let group = "Dashboard";
  if (suite === "ui" || suite === "themes") group = "Design System";
  else if (suite === "workbench") {
    group = "Workbench Core";
    path = path.filter((part) => part !== "pstdio-workbench" && part !== "Workbench");
  } else if (path[0] === "Extensions") {
    group = "Extensions";
    path = path.slice(1);
  } else if (path[0] === "Canvas" || path[0] === "Motion Lab") group = "Extensions";
  if (suite === "website") path = ["Website", ...path];
  return { group, path };
};
