import { createResource } from "./resources";

export const dashboardTicketTags = [
  {
    name: "priority",
    label: "Priority",
    options: [
      { value: "high", label: "High", color: "red" },
      { value: "medium", label: "Medium", color: "yellow" },
      { value: "low", label: "Low", color: "gray" },
    ],
  },
  {
    name: "area",
    label: "Area",
    options: [
      { value: "workbench", label: "Workbench", color: "blue" },
      { value: "sessions", label: "Sessions", color: "purple" },
      { value: "infra", label: "Infra", color: "green" },
    ],
  },
];

export const dashboardStatusColumns = [
  { id: "backlog", label: "Backlog", color: "gray" },
  { id: "in-progress", label: "In progress", color: "blue" },
  { id: "review", label: "Review", color: "purple" },
  { id: "done", label: "Done", color: "green" },
];

const ticketRows = [
  {
    id: "PS-294",
    title: "Migrate dashboard primitives onto workbench shell",
    status: "in-progress",
    assignee: "Aure",
    priority: "high",
    area: "workbench",
    updatedAt: "2026-05-17T08:30:00Z",
    workspace: {
      shorthand: "A1",
      type: "worktree",
      status: { name: "Running", color: "blue", description: "Agent session is applying the workbench bridge." },
      sessionStatus: "in_progress",
      additions: 148,
      deletions: 37,
      sessions: [
        { id: "PS-294-session-1", title: "Apply workbench bridge", status: "in_progress" },
        { id: "PS-294-session-2", title: "Review shell layout", status: "completed" },
      ],
    },
  },
  {
    id: "PS-298",
    title: "Move project shell routes into workbench areas",
    status: "backlog",
    assignee: "Sam",
    priority: "medium",
    area: "workbench",
    updatedAt: "2026-05-16T16:15:00Z",
    workspace: {
      shorthand: "A2",
      type: "current_branch",
      status: { name: "Queued", color: "yellow", description: "Waiting for PS-294 to settle." },
      sessionStatus: "queued",
      additions: 0,
      deletions: 0,
      sessions: [{ id: "PS-298-session-1", title: "Queue project route move", status: "queued" }],
    },
  },
  {
    id: "PS-201",
    title: "Add command palette quick actions",
    status: "review",
    assignee: "Nora",
    priority: "medium",
    area: "sessions",
    updatedAt: "2026-05-15T11:45:00Z",
    workspace: {
      shorthand: "B1",
      type: "worktree",
      status: { name: "Review", color: "purple", description: "Ready for reviewer pass." },
      sessionStatus: "awaiting_input",
      additions: 52,
      deletions: 14,
      sessions: [{ id: "PS-201-session-1", title: "Add command palette quick actions", status: "awaiting_input" }],
    },
  },
  {
    id: "PS-198",
    title: "Theme dashboard surfaces",
    status: "done",
    assignee: "Mika",
    priority: "low",
    area: "workbench",
    updatedAt: "2026-05-14T09:20:00Z",
    workspace: {
      shorthand: "C1",
      type: "worktree",
      status: { name: "Merged", color: "green", description: "Changes merged into main." },
      sessionStatus: "completed",
      additions: 81,
      deletions: 22,
      sessions: [{ id: "PS-198-session-1", title: "Theme dashboard surfaces", status: "completed" }],
    },
  },
];

export const dashboardTickets = ticketRows.map((ticket) => ({
  ...ticket,
  ticketId: ticket.id,
  statusColor: dashboardStatusColumns.find((column) => column.id === ticket.status)?.color,
  tags: [
    { name: "priority", value: ticket.priority },
    { name: "area", value: ticket.area },
  ],
  resource: createResource("ticket", ticket.id, `${ticket.id} ${ticket.title}`, "Ticket"),
  workspaceResource: createResource(
    "workspace",
    ticket.id,
    `${ticket.id} Attempt ${ticket.workspace.shorthand}`,
    "GitBranch",
  ),
}));
