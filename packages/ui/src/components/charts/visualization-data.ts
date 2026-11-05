export const activity = [
  { day: "Mon", value: 8, low: 5, high: 10 },
  { day: "Tue", value: 12, low: 8, high: 15 },
  { day: "Wed", value: 9, low: 7, high: 12 },
  { day: "Thu", value: 17, low: 12, high: 20 },
  { day: "Fri", value: 14, low: 11, high: 18 },
];
export const series = activity.flatMap((row, index) => [
  { ...row, team: "Core", value: row.value },
  { ...row, team: "Cloud", value: 4 + index * 2 },
]);
export const parts = [
  { name: "Core", value: 42 },
  { name: "Cloud", value: 33 },
  { name: "Mobile", value: 25 },
];
export const observations = Array.from({ length: 60 }, (_, index) => ({
  id: `sample-${index}`,
  team: ["Core", "Cloud", "Mobile"][index % 3],
  x: 4 + ((index * 17) % 80),
  value: 10 + ((index * 13) % 37) + Math.sin(index) * 7,
  size: 3 + (index % 7),
}));
export const matrix = ["Core", "Cloud", "Mobile"].flatMap((team, index) =>
  activity.map(({ day }, column) => ({ team, day, score: (index + column * 2) % 5 })),
);
export const nodes = [
  { id: "Plan", x: 0, y: 2 },
  { id: "Build", x: 1, y: 3 },
  { id: "Review", x: 1, y: 1 },
  { id: "Release", x: 2, y: 2 },
];
export const edges = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
].map(([a, b]) => ({ x1: nodes[a].x, y1: nodes[a].y, x2: nodes[b].x, y2: nodes[b].y }));
export const galleryTasks = [
  { id: "schema", label: "Define project structure", group: "Foundation", start: 0, end: 4, progress: 1 },
  {
    id: "nav",
    label: "Build project navigation",
    group: "Foundation",
    start: 4,
    end: 7,
    progress: 0.3,
    dependsOn: ["schema"],
  },
  { id: "preview", label: "Review working preview", group: "Preview", start: 7, end: 9, dependsOn: ["nav"] },
];
export const galleryMilestones = [
  { id: "foundation", label: "Foundation", value: 7 },
  { id: "preview", label: "Preview", value: 9 },
];
