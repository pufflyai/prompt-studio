export type WidgetKind = "metric" | "line" | "bar" | "table";
export type WidgetSource = "conversations" | "users" | "warnings";
export type DashboardLayoutMode = "vertical" | "horizontal" | "free";
export interface DashboardDefinition {
  mode: DashboardLayoutMode;
  widgets: DashboardWidget[];
}
export const layoutModes = [
  { id: "vertical", name: "Compact up" },
  { id: "horizontal", name: "Compact left" },
  { id: "free", name: "Free placement" },
];
export interface GridPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface DashboardWidget {
  id: string;
  title: string;
  kind: WidgetKind;
  source: WidgetSource;
  layout: GridPlacement;
}

export const widgetKinds = [
  { id: "metric", name: "Metric" },
  { id: "line", name: "Line chart" },
  { id: "bar", name: "Bar chart" },
  { id: "table", name: "Table" },
];
export const sources = [
  { id: "conversations", name: "Conversations" },
  { id: "users", name: "Active users" },
  { id: "warnings", name: "Warnings" },
];
export const initialWidgets: DashboardWidget[] = [
  {
    id: "conversations",
    title: "Agent conversations",
    kind: "metric",
    source: "conversations",
    layout: { x: 0, y: 0, w: 4, h: 3 },
  },
  { id: "users", title: "Active users", kind: "metric", source: "users", layout: { x: 4, y: 0, w: 4, h: 3 } },
  { id: "warnings", title: "Warnings", kind: "metric", source: "warnings", layout: { x: 8, y: 0, w: 4, h: 3 } },
  {
    id: "volume",
    title: "Conversation volume",
    kind: "bar",
    source: "conversations",
    layout: { x: 0, y: 3, w: 6, h: 8 },
  },
  { id: "trend", title: "Active users over time", kind: "line", source: "users", layout: { x: 6, y: 3, w: 6, h: 8 } },
  {
    id: "recent",
    title: "Recent conversations",
    kind: "table",
    source: "conversations",
    layout: { x: 0, y: 11, w: 12, h: 8 },
  },
];

const counts = [34, 42, 47, 39, 68, 94, 137];
export const activity = counts.flatMap((count, day) => [
  { day: `Nov ${day + 6}`, agent: "Notebook", count: Math.round(count * 0.48) },
  { day: `Nov ${day + 6}`, agent: "Threads", count: Math.round(count * 0.32) },
  { day: `Nov ${day + 6}`, agent: "Modeling", count: count - Math.round(count * 0.48) - Math.round(count * 0.32) },
]);

export const trends = {
  conversations: counts,
  users: [21, 28, 24, 36, 41, 57, 78],
  warnings: [3, 7, 5, 12, 8, 16, 13],
};
export const totals = { conversations: 461, users: 78, warnings: 64 };
export const recentTotals = { conversations: 299, users: 64, warnings: 37 };
export const changes = { conversations: "+18.2%", users: "+12.8%", warnings: "−8.6%" };
export const conversations = [
  {
    Date: "1 minute ago",
    Agent: "Notebook",
    User: "Hayley Lee",
    Prompt: "How did churn trend over the last quarter?",
    Topic: "Churn analysis",
    Warnings: 0,
  },
  {
    Date: "4 minutes ago",
    Agent: "Threads",
    User: "Orla Gartland",
    Prompt: "Why has revenue dipped in the past three quarters?",
    Topic: "Sales breakdown",
    Warnings: 2,
  },
  {
    Date: "1 hour ago",
    Agent: "Modeling",
    User: "Joey Cruz",
    Prompt: "Help me define measures and dimensions",
    Topic: "Sector analysis",
    Warnings: 0,
  },
  {
    Date: "1 hour ago",
    Agent: "Threads",
    User: "Pearl Adams",
    Prompt: "Give me a breakdown of customer revenue",
    Topic: "Sector revenue",
    Warnings: 0,
  },
  {
    Date: "2 hours ago",
    Agent: "Notebook",
    User: "Yvette Young",
    Prompt: "What are this quarter’s top customer pain points?",
    Topic: "Quarterly trends",
    Warnings: 1,
  },
];

export const sourceTables = {
  conversations,
  users: [
    { User: "Hayley Lee", Conversations: 32, Role: "Admin" },
    { User: "Orla Gartland", Conversations: 26, Role: "Editor" },
    { User: "Joey Cruz", Conversations: 18, Role: "Explorer" },
  ],
  warnings: conversations.filter((row) => row.Warnings > 0),
};
