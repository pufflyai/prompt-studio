import type { ResourceRef } from "../core";

export const signalRoomResourceKind = "signal-room";

export const signalRoomWidgetIds = {
  top: "signal-room.top",
  rail: "signal-room.rail",
  header: "signal-room.header",
  surface: "signal-room.surface",
  queue: "signal-room.queue",
  context: "signal-room.context",
  log: "signal-room.log",
  status: "signal-room.status",
  assistant: "signal-room.assistant",
} as const;

export const signalRoomResources = {
  surface: {
    kind: signalRoomResourceKind,
    id: "surface",
    uri: "pstdio://signal-room/surface",
    label: "Signal surface",
    icon: "Radar",
    metadata: { widgetId: signalRoomWidgetIds.surface },
  },
  queue: {
    kind: signalRoomResourceKind,
    id: "queue",
    uri: "pstdio://signal-room/queue",
    label: "Escalation queue",
    icon: "ListChecks",
    metadata: { widgetId: signalRoomWidgetIds.queue },
  },
} satisfies Record<string, ResourceRef>;

export const signalRoomChannels = [
  { id: "deploy", label: "Deploy", icon: "Rocket", resource: signalRoomResources.surface },
  { id: "queue", label: "Queue", icon: "ListChecks", resource: signalRoomResources.queue },
  { id: "review", label: "Review", icon: "MessagesSquare", resource: signalRoomResources.surface },
  { id: "locks", label: "Locks", icon: "ShieldCheck", resource: signalRoomResources.surface },
];

export const signalRoomLanes = [
  { label: "API", value: "92", color: "green", detail: "steady" },
  { label: "Runner", value: "71", color: "yellow", detail: "watch" },
  { label: "Builds", value: "38", color: "red", detail: "blocked" },
  { label: "Docs", value: "84", color: "blue", detail: "clear" },
];

export const signalRoomQueueItems = [
  { id: "SR-18", title: "Release gate waiting on smoke output", owner: "Mina", color: "yellow" },
  { id: "SR-22", title: "Extension manifest needs one approval", owner: "Jules", color: "blue" },
  { id: "SR-27", title: "Template bundle drift detected", owner: "Ari", color: "red" },
];

export const signalRoomRunbookItems = [
  { label: "Freeze writes", value: "ready" },
  { label: "Notify extension owners", value: "queued" },
  { label: "Replay package smoke", value: "running" },
  { label: "Publish summary", value: "blocked" },
];

export const signalRoomLogRows = [
  { time: "10:03", label: "Queue promoted SR-18", severity: "warning" },
  { time: "10:01", label: "Runner capacity recovered", severity: "success" },
  { time: "09:58", label: "Manifest diff attached", severity: "info" },
  { time: "09:55", label: "Bundle smoke opened", severity: "info" },
];
